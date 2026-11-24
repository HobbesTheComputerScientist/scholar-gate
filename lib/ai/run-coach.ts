import {
  FunctionCallingConfigMode,
  type Content,
  type FunctionCall,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";

import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_SUMMARY_MODEL,
  GeminiUnavailableError,
  generateWithFallback,
  getGeminiApiKey,
  streamWithFallback,
} from "@/lib/ai/gemini";
import { localCoach } from "@/lib/ai/local-coach";
import { findReadings } from "@/lib/ai/readings";
import { coachTools } from "@/lib/ai/tools";
import {
  recommendReadingsPayloadSchema,
  updateProfilePayloadSchema,
  validateToolOutput,
} from "@/lib/db/schema";
import type { PatchTool } from "@/lib/db/types";
import type { PaperHit } from "@/lib/papers/openalex";
import type { AssembleInput } from "@/lib/prompt/assemble";
import { assemblePrompt } from "@/lib/prompt/assemble";

export { DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_SUMMARY_MODEL, getGeminiApiKey };

export type CoachEvent =
  | { type: "text"; delta: string }
  | { type: "patch"; tool: PatchTool; payload: Record<string, unknown> }
  /** Profile fields applied directly (no review step). */
  | { type: "profile"; payload: Record<string, unknown> }
  /** Real OpenAlex papers found for the coach's search queries. */
  | { type: "readings"; queries: string[]; hits: PaperHit[] }
  | { type: "notice"; message: string };

/** Teaching replies are long; leave room for thinking plus a full answer. */
const COACH_MAX_OUTPUT_TOKENS = 8192;

function normalizeToolPayload(args: unknown): unknown {
  if (!args || typeof args !== "object") {
    return {};
  }
  const payload = { ...(args as Record<string, unknown>) };
  for (const key of ["chosenQuestion", "noveltyClaim", "rationale"] as const) {
    if (payload[key] === "") {
      payload[key] = null;
    }
  }
  return payload;
}

type ToolOutcome = { events: CoachEvent[]; response: Record<string, unknown> };

/**
 * Runs one tool call server-side. Returns the events for the chat stream and
 * the functionResponse sent back to the model so it can keep writing.
 */
async function handleToolCall(name: string, args: unknown): Promise<ToolOutcome> {
  try {
    if (name === "update_profile") {
      const payload = updateProfilePayloadSchema.parse(args ?? {});
      return {
        events: [{ type: "profile", payload }],
        response: { status: "applied", fields: Object.keys(payload) },
      };
    }
    if (name === "recommend_readings") {
      const { queries } = recommendReadingsPayloadSchema.parse(args ?? {});
      const hits = await findReadings(queries);
      return {
        events: [{ type: "readings", queries, hits }],
        response: {
          note: "These real papers are listed under your reply automatically. You may mention them by title; do not invent others.",
          papers: hits.map((hit) => ({
            title: hit.title,
            authors: hit.authors.slice(0, 3),
            year: hit.year,
            citations: hit.citationCount,
            freeToRead: Boolean(hit.openAccessUrl),
            abstract: hit.abstract?.slice(0, 400) ?? null,
          })),
        },
      };
    }
    const validated = validateToolOutput(name, normalizeToolPayload(args));
    return {
      events: [
        {
          type: "patch",
          tool: validated.tool,
          payload: validated.payload as Record<string, unknown>,
        },
      ],
      response: {
        status: "proposed",
        note: "Shown to the student as a suggestion; it is saved only if they accept it.",
      },
    };
  } catch (error) {
    // Invalid tool JSON is never written; the model is told so.
    return {
      events: [],
      response: {
        error: `Invalid arguments: ${
          error instanceof Error ? error.message.slice(0, 200) : "unknown"
        }`,
      },
    };
  }
}

async function* localFallback(input: AssembleInput): AsyncGenerator<CoachEvent> {
  const result = localCoach(input);
  yield { type: "text", delta: result.text };
  for (const patch of result.patches) {
    const outcome = await handleToolCall(patch.tool, patch.payload);
    yield* outcome.events;
  }
}

/** Tool rounds per student message (each round may call several tools). */
const MAX_TOOL_ROUNDS = 3;

export async function* runCoach(
  input: AssembleInput,
): AsyncGenerator<CoachEvent> {
  const assembled = assemblePrompt(input);

  if (!getGeminiApiKey()) {
    yield* localFallback(input);
    return;
  }

  const config = {
    systemInstruction: assembled.system,
    maxOutputTokens: COACH_MAX_OUTPUT_TOKENS,
    tools: [{ functionDeclarations: coachTools }],
    automaticFunctionCalling: { disable: true },
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
    },
  };
  const contents: Content[] = [
    { role: "user", parts: [{ text: assembled.user }] },
  ];
  let model: string | undefined;
  let wroteText = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    let stream: AsyncGenerator<GenerateContentResponse>;
    try {
      // Later rounds must stay on the same model: Gemini 3 signs its tool
      // calls (thought signatures) and only that model accepts them back.
      const started = await streamWithFallback({
        contents,
        config,
        primaryModel: model,
        pinModel: round > 0,
      });
      stream = started.stream;
      model = started.model;
    } catch (error) {
      if (!(error instanceof GeminiUnavailableError)) throw error;
      if (wroteText) return;
      yield {
        type: "notice",
        message:
          "The AI coach is overloaded right now, so this is a shorter built-in reply. Try again in a minute for a full answer.",
      };
      yield* localFallback(input);
      return;
    }

    const modelParts: Part[] = [];
    const calls: FunctionCall[] = [];
    try {
      for await (const chunk of stream) {
        if (chunk.text) {
          wroteText = true;
          yield { type: "text", delta: chunk.text };
        }
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          modelParts.push(part);
          if (part.functionCall?.name) calls.push(part.functionCall);
        }
      }
    } catch (error) {
      // The model can drop mid-reply (e.g. 503 under load). Keep what was
      // written instead of failing the whole turn.
      console.warn(
        `[coach] stream from ${model} broke: ${
          error instanceof Error ? error.message.slice(0, 120) : String(error)
        }`,
      );
      if (wroteText) {
        yield {
          type: "notice",
          message:
            "The AI service got busy and the reply was cut short. Say \"continue\" to get the rest.",
        };
        return;
      }
      yield {
        type: "notice",
        message:
          "The AI coach is overloaded right now, so this is a shorter built-in reply. Try again in a minute for a full answer.",
      };
      yield* localFallback(input);
      return;
    }

    if (calls.length === 0) break;

    const responses: Part[] = [];
    for (const call of calls) {
      const outcome = await handleToolCall(call.name!, call.args);
      yield* outcome.events;
      responses.push({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: outcome.response,
        },
      });
    }
    contents.push({ role: "model", parts: modelParts });
    contents.push({ role: "user", parts: responses });
  }

  if (!wroteText) {
    yield* localFallback(input);
  }
}

export async function runRollingSummary(input: AssembleInput): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const assembled = assemblePrompt(input);
  const { response } = await generateWithFallback({
    primaryModel:
      process.env.GEMINI_SUMMARY_MODEL?.trim() || DEFAULT_GEMINI_SUMMARY_MODEL,
    contents: assembled.user,
    config: {
      systemInstruction: `${assembled.system}

Write a concise rolling summary of progress using only facts from the Project Brain, saved papers, and decisions. Do not invent citations. Do not call tools.`,
      maxOutputTokens: 600,
      tools: [],
    },
  });

  const text = response.text?.trim();
  return text || null;
}
