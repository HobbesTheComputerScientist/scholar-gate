import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type FunctionCall,
} from "@google/genai";

import { localCoach } from "@/lib/ai/local-coach";
import { coachTools } from "@/lib/ai/tools";
import { validateToolOutput } from "@/lib/db/schema";
import type { PatchTool } from "@/lib/db/types";
import type { AssembleInput } from "@/lib/prompt/assemble";
import { assemblePrompt } from "@/lib/prompt/assemble";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_SUMMARY_MODEL = "gemini-3.5-flash-lite";

export type CoachEvent =
  | { type: "text"; delta: string }
  | {
      type: "patch";
      tool: PatchTool;
      payload: Record<string, unknown>;
    };

export function getGeminiApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : undefined;
}

function createClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

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

function* emitValidatedPatch(
  name: string,
  args: unknown,
): Generator<CoachEvent> {
  try {
    const validated = validateToolOutput(name, normalizeToolPayload(args));
    yield {
      type: "patch",
      tool: validated.tool,
      payload: validated.payload as Record<string, unknown>,
    };
  } catch {
    // Invalid tool JSON is ignored; the student never sees a bad write.
  }
}

export async function* runCoach(
  input: AssembleInput,
): AsyncGenerator<CoachEvent> {
  const assembled = assemblePrompt(input);
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    const result = localCoach(input);
    yield { type: "text", delta: result.text };
    for (const patch of result.patches) {
      yield* emitValidatedPatch(patch.tool, patch.payload);
    }
    return;
  }

  const client = createClient(apiKey);
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const stream = await client.models.generateContentStream({
    model,
    contents: assembled.user,
    config: {
      systemInstruction: assembled.system,
      maxOutputTokens: 1600,
      tools: [{ functionDeclarations: coachTools }],
      automaticFunctionCalling: { disable: true },
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO,
        },
      },
    },
  });

  const emittedCalls = new Set<string>();

  for await (const chunk of stream) {
    if (chunk.text) {
      yield { type: "text", delta: chunk.text };
    }

    const calls: FunctionCall[] = chunk.functionCalls ?? [];
    for (const call of calls) {
      if (!call.name) {
        continue;
      }
      const fingerprint = `${call.id ?? ""}:${call.name}:${JSON.stringify(call.args ?? {})}`;
      if (emittedCalls.has(fingerprint)) {
        continue;
      }
      emittedCalls.add(fingerprint);
      yield* emitValidatedPatch(call.name, call.args);
    }
  }
}

export async function runRollingSummary(input: AssembleInput): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const assembled = assemblePrompt(input);
  const client = createClient(apiKey);
  const model =
    process.env.GEMINI_SUMMARY_MODEL?.trim() || DEFAULT_GEMINI_SUMMARY_MODEL;

  const response = await client.models.generateContent({
    model,
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
