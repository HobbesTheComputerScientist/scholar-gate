import {
  GoogleGenAI,
  ThinkingLevel,
  type ContentListUnion,
  type GenerateContentConfig,
  type GenerateContentResponse,
} from "@google/genai";

/**
 * Shared Gemini access with a model fallback chain.
 *
 * Gemini regularly answers 503 "high demand" (or 429) for a busy model. We try
 * the configured model first, then progressively lighter ones, and remember
 * unhealthy models for a short while so later requests skip them.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_SUMMARY_MODEL = "gemini-3.5-flash-lite";

const FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

/** How long one model gets to produce its first chunk / full JSON reply. */
const FIRST_CHUNK_TIMEOUT_MS = 15_000;
const UNHEALTHY_FOR_MS = 2 * 60_000;

const globalForGemini = globalThis as typeof globalThis & {
  __researchCoachUnhealthyModels?: Map<string, number>;
};

function unhealthy(): Map<string, number> {
  globalForGemini.__researchCoachUnhealthyModels ??= new Map();
  return globalForGemini.__researchCoachUnhealthyModels;
}

export function getGeminiApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : undefined;
}

/** Primary model first, then fallbacks; recently failing models go last. */
export function modelChain(primary?: string): string[] {
  const first =
    primary?.trim() || process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const ordered = [first, ...FALLBACK_MODELS.filter((m) => m !== first)];
  const now = Date.now();
  const healthy = ordered.filter((m) => (unhealthy().get(m) ?? 0) < now);
  const sick = ordered.filter((m) => (unhealthy().get(m) ?? 0) >= now);
  return [...healthy, ...sick];
}

function markUnhealthy(model: string) {
  unhealthy().set(model, Date.now() + UNHEALTHY_FOR_MS);
}

/** 503/429/404/timeouts: try the next model. Anything else is a real error. */
function shouldFallBack(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /\b(503|429|404|500|UNAVAILABLE|RESOURCE_EXHAUSTED|NOT_FOUND|overloaded|high demand|timed? ?out|aborted|AbortError)\b/i.test(
    text,
  );
}

/** Gemini 3 models think by default; keep it light so text is not starved. */
function withDefaults(config: GenerateContentConfig): GenerateContentConfig {
  return {
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    ...config,
  };
}

function client(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

export class GeminiUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      `All Gemini models are busy right now (${
        cause instanceof Error ? cause.message.slice(0, 120) : "unknown error"
      }).`,
    );
    this.name = "GeminiUnavailableError";
  }
}

export async function generateWithFallback(params: {
  contents: ContentListUnion;
  config: GenerateContentConfig;
  primaryModel?: string;
  /** Use only primaryModel (e.g. to continue a turn with thought signatures). */
  pinModel?: boolean;
  timeoutMs?: number;
}): Promise<{ response: GenerateContentResponse; model: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new GeminiUnavailableError(new Error("GEMINI_API_KEY is not set"));
  const ai = client(apiKey);
  let lastError: unknown = null;
  const models =
    params.pinModel && params.primaryModel
      ? [params.primaryModel]
      : modelChain(params.primaryModel);
  for (const model of models) {
    const abort = new AbortController();
    const timer = setTimeout(
      () => abort.abort(new Error("timed out")),
      params.timeoutMs ?? FIRST_CHUNK_TIMEOUT_MS * 2,
    );
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: { ...withDefaults(params.config), abortSignal: abort.signal },
      });
      return { response, model };
    } catch (error) {
      lastError = error;
      if (!shouldFallBack(error)) throw error;
      markUnhealthy(model);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new GeminiUnavailableError(lastError);
}

/**
 * Streams from the first model that starts answering. Falls back only before
 * the first chunk arrives; once text is flowing we stay on that model.
 */
export async function streamWithFallback(params: {
  contents: ContentListUnion;
  config: GenerateContentConfig;
  primaryModel?: string;
  /** Use only primaryModel (e.g. to continue a turn with thought signatures). */
  pinModel?: boolean;
}): Promise<{ stream: AsyncGenerator<GenerateContentResponse>; model: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new GeminiUnavailableError(new Error("GEMINI_API_KEY is not set"));
  const ai = client(apiKey);
  let lastError: unknown = null;

  const models =
    params.pinModel && params.primaryModel
      ? [params.primaryModel]
      : modelChain(params.primaryModel);
  for (const model of models) {
    const abort = new AbortController();
    const startedAt = Date.now();
    const timer = setTimeout(
      () => abort.abort(new Error("timed out")),
      FIRST_CHUNK_TIMEOUT_MS,
    );
    try {
      const raw = await ai.models.generateContentStream({
        model,
        contents: params.contents,
        config: { ...withDefaults(params.config), abortSignal: abort.signal },
      });
      const iterator = raw[Symbol.asyncIterator]();
      const first = await iterator.next();
      clearTimeout(timer);
      console.info(
        `[gemini] ${model} first chunk in ${Date.now() - startedAt}ms`,
      );
      async function* rest(): AsyncGenerator<GenerateContentResponse> {
        if (!first.done) yield first.value;
        while (true) {
          const next = await iterator.next();
          if (next.done) return;
          yield next.value;
        }
      }
      return { stream: rest(), model };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      console.warn(
        `[gemini] ${model} failed after ${Date.now() - startedAt}ms: ${
          error instanceof Error ? error.message.slice(0, 120) : String(error)
        }`,
      );
      if (!shouldFallBack(error)) throw error;
      markUnhealthy(model);
    }
  }
  throw new GeminiUnavailableError(lastError);
}
