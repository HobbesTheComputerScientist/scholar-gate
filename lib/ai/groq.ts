import type { FunctionDeclaration } from "@google/genai";

/**
 * Groq (OpenAI-compatible) client: the fast primary provider when
 * GROQ_API_KEY is set. Server-only.
 * Docs: https://console.groq.com/docs/api-reference
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const DEFAULT_GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"];

const FIRST_TOKEN_TIMEOUT_MS = 12_000;
const UNHEALTHY_FOR_MS = 2 * 60_000;

const globalForGroq = globalThis as typeof globalThis & {
  __researchCoachGroqUnhealthy?: Map<string, number>;
};

function unhealthy(): Map<string, number> {
  globalForGroq.__researchCoachGroqUnhealthy ??= new Map();
  return globalForGroq.__researchCoachGroqUnhealthy;
}

export function getGroqApiKey(): string | undefined {
  const key = process.env.GROQ_API_KEY?.trim();
  return key ? key : undefined;
}

/** GROQ_MODEL (comma-separated allowed) first, then defaults; sick ones last. */
export function groqModelChain(): string[] {
  const configured = (process.env.GROQ_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const ordered = [...new Set([...configured, ...DEFAULT_GROQ_MODELS])];
  const now = Date.now();
  return [
    ...ordered.filter((m) => (unhealthy().get(m) ?? 0) < now),
    ...ordered.filter((m) => (unhealthy().get(m) ?? 0) >= now),
  ];
}

/**
 * Skip a failing model for a while. For 429s Groq says how long to wait
 * ("Please try again in 1.53s"); honour that instead of the default.
 */
function markUnhealthy(model: string, error?: unknown) {
  const text = error instanceof Error ? error.message : "";
  const retry = /try again in ([\d.]+)(ms|s)/i.exec(text);
  const waitMs = retry
    ? Number(retry[1]) * (retry[2].toLowerCase() === "ms" ? 1 : 1000) + 500
    : /\b429\b/.test(text)
      ? 20_000
      : UNHEALTHY_FOR_MS;
  unhealthy().set(model, Date.now() + waitMs);
}

export type GroqToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type GroqMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type GroqTool = {
  type: "function";
  function: { name: string; description?: string; parameters: unknown };
};

/** Gemini declarations → OpenAI-style tools (same JSON schemas). */
export function toGroqTools(declarations: FunctionDeclaration[]): GroqTool[] {
  return declarations.map((declaration) => ({
    type: "function",
    function: {
      name: declaration.name ?? "unknown",
      description: declaration.description,
      parameters: declaration.parametersJsonSchema ?? {
        type: "object",
        properties: {},
      },
    },
  }));
}

export class GroqUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      `Groq is unavailable (${
        cause instanceof Error ? cause.message.slice(0, 160) : "unknown error"
      }).`,
    );
    this.name = "GroqUnavailableError";
  }
}

export type GroqStreamEvent =
  | { type: "text"; delta: string }
  | { type: "done"; toolCalls: GroqToolCall[]; content: string };

async function open(
  model: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Response> {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new GroqUnavailableError(new Error("GROQ_API_KEY is not set"));
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, ...body }),
    signal,
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`Groq ${response.status}: ${detail}`);
  }
  return response;
}

/**
 * Streams one chat completion. Picks the first model that answers; once
 * tokens flow it stays on that model. Tool-call deltas are assembled.
 */
export async function streamGroq(params: {
  messages: GroqMessage[];
  tools?: GroqTool[];
  maxTokens?: number;
  /** Continue on this model only (mid tool loop). */
  model?: string;
}): Promise<{ model: string; events: AsyncGenerator<GroqStreamEvent> }> {
  let lastError: unknown = null;
  // Prefer the model already used this turn, but any Groq model can take
  // over (no thought signatures, unlike Gemini). Free tier limits are per
  // model, so switching after a 429 usually succeeds immediately.
  const chain = groqModelChain();
  const models = params.model
    ? [params.model, ...chain.filter((m) => m !== params.model)]
    : chain;
  for (const model of models) {
    const abort = new AbortController();
    const startedAt = Date.now();
    const timer = setTimeout(
      () => abort.abort(new Error("timed out")),
      FIRST_TOKEN_TIMEOUT_MS,
    );
    try {
      const response = await open(
        model,
        {
          messages: params.messages,
          stream: true,
          // Free-tier limits count reserved output tokens; keep this modest.
          max_completion_tokens: params.maxTokens ?? 4096,
          ...(params.tools?.length
            ? { tools: params.tools, tool_choice: "auto" }
            : {}),
        },
        abort.signal,
      );
      clearTimeout(timer);
      console.info(`[groq] ${model} connected in ${Date.now() - startedAt}ms`);
      return { model, events: readStream(response) };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      console.warn(
        `[groq] ${model} failed after ${Date.now() - startedAt}ms: ${
          error instanceof Error ? error.message.slice(0, 160) : String(error)
        }`,
      );
      markUnhealthy(model, error);
    }
  }
  throw new GroqUnavailableError(lastError);
}

async function* readStream(response: Response): AsyncGenerator<GroqStreamEvent> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const calls: GroqToolCall[] = [];
  let content = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const parsed = JSON.parse(line.slice(6)) as {
        choices?: {
          delta?: {
            content?: string | null;
            tool_calls?: {
              index: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }[];
          };
        }[];
        error?: { message?: string };
      };
      if (parsed.error) throw new Error(parsed.error.message ?? "Groq stream error");
      const delta = parsed.choices?.[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        yield { type: "text", delta: delta.content };
      }
      for (const call of delta?.tool_calls ?? []) {
        const slot = (calls[call.index] ??= {
          id: call.id ?? `call_${call.index}`,
          type: "function",
          function: { name: "", arguments: "" },
        });
        if (call.id) slot.id = call.id;
        if (call.function?.name) slot.function.name += call.function.name;
        if (call.function?.arguments) slot.function.arguments += call.function.arguments;
      }
    }
  }
  yield { type: "done", toolCalls: calls.filter(Boolean), content };
}

/** One non-streamed JSON completion (comprehension check, summaries). */
export async function groqJson(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<unknown> {
  let lastError: unknown = null;
  for (const model of groqModelChain()) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(new Error("timed out")), 30_000);
    try {
      const response = await open(
        model,
        {
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: params.maxTokens ?? 4096,
        },
        abort.signal,
      );
      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      console.warn(
        `[groq] ${model} JSON failed: ${
          error instanceof Error ? error.message.slice(0, 160) : String(error)
        }`,
      );
      if (!(error instanceof SyntaxError)) markUnhealthy(model, error);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new GroqUnavailableError(lastError);
}

/** Plain text completion (rolling summary). */
export async function groqText(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const { events } = await streamGroq({
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    maxTokens: params.maxTokens,
  });
  let text = "";
  for await (const event of events) {
    if (event.type === "text") text += event.delta;
  }
  return text.trim();
}
