import { z } from "zod";

import type { PaperStance } from "@/lib/db/types";

/**
 * OpenAlex `/works` search. Server-only: reads OPENALEX_API_KEY.
 * Docs: https://docs.openalex.org/api-entities/works/search-works
 */

export const PAPER_SEARCH_MODES = [
  "general",
  "foundational",
  "conflicting",
] as const;
export type PaperSearchMode = (typeof PAPER_SEARCH_MODES)[number];

/** Stance a hit is saved with by default, given the search that found it. */
export const DEFAULT_STANCE_FOR_MODE: Record<PaperSearchMode, PaperStance> = {
  general: "neutral",
  foundational: "foundational",
  conflicting: "conflicting",
};

export type PaperHit = {
  source: "openalex";
  externalId: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
  url: string | null;
  citationCount: number | null;
  doi: string | null;
  publicationYear: number | null;
  openAccessUrl: string | null;
};

const OPENALEX_WORKS_URL = "https://api.openalex.org/works";

/** Terms that tend to surface critiques, failure cases, and replications. */
const COUNTER_EVIDENCE_TERMS = [
  "limitations",
  "critique",
  "revisiting",
  "rethinking",
  "failure",
  "fails",
  "counterexample",
  "reproducibility",
  "negative results",
];

/** Short topics are quoted as a phrase so OR'd terms cannot outweigh them. */
const MAX_PHRASE_WORDS = 4;

/** Foundational: rerank this many relevance hits by citations. */
const FOUNDATIONAL_POOL = 25;

const SELECT_FIELDS = [
  "id",
  "display_name",
  "publication_year",
  "authorships",
  "abstract_inverted_index",
  "cited_by_count",
  "doi",
  "open_access",
  "best_oa_location",
  "primary_location",
].join(",");

/** Validate only what we read; OpenAlex returns many more fields. */
const openAlexWorkSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable().optional(),
  publication_year: z.number().int().nullable().optional(),
  authorships: z
    .array(
      z.object({
        author: z
          .object({ display_name: z.string().nullable().optional() })
          .nullable()
          .optional(),
      }),
    )
    .nullable()
    .optional(),
  abstract_inverted_index: z
    .record(z.string(), z.array(z.number().int()))
    .nullable()
    .optional(),
  cited_by_count: z.number().int().nullable().optional(),
  doi: z.string().nullable().optional(),
  open_access: z
    .object({ oa_url: z.string().nullable().optional() })
    .nullable()
    .optional(),
  best_oa_location: z
    .object({
      pdf_url: z.string().nullable().optional(),
      landing_page_url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  primary_location: z
    .object({ landing_page_url: z.string().nullable().optional() })
    .nullable()
    .optional(),
});

const openAlexResponseSchema = z.object({
  results: z.array(z.unknown()).default([]),
});

export type OpenAlexWork = z.infer<typeof openAlexWorkSchema>;

/**
 * OpenAlex stores abstracts as `{ word: [positions...] }`.
 * Rebuild plain text by placing each word at its positions.
 */
export function decodeAbstract(
  index: Record<string, number[]> | null | undefined,
): string | null {
  if (!index) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) {
      if (Number.isInteger(position) && position >= 0) {
        words[position] = word;
      }
    }
  }
  const text = words
    .filter((word) => word !== undefined)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : null;
}

/** Turn a student query into OpenAlex `search` syntax for the chosen mode. */
export function buildSearchQuery(query: string, mode: PaperSearchMode): string {
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (mode !== "conflicting") return trimmed;
  const usesSyntax = /["()]|\b(AND|OR|NOT)\b/.test(trimmed);
  const topic =
    !usesSyntax && trimmed.split(" ").length <= MAX_PHRASE_WORDS
      ? `"${trimmed}"`
      : `(${trimmed})`;
  const terms = COUNTER_EVIDENCE_TERMS.map((term) =>
    term.includes(" ") ? `"${term}"` : term,
  ).join(" OR ");
  return `${topic} AND (${terms})`;
}

export function buildSearchParams(
  query: string,
  mode: PaperSearchMode,
  limit: number,
  apiKey: string | undefined,
): URLSearchParams {
  // Foundational pulls a larger relevance-ranked pool, reranked by citations
  // in searchOpenAlex. A global citation sort drags in off-topic mega-cited
  // work (stats packages, reporting guidelines).
  const perPage =
    mode === "foundational" ? Math.max(limit, FOUNDATIONAL_POOL) : limit;
  const params = new URLSearchParams({
    search: buildSearchQuery(query, mode),
    per_page: String(perPage),
    select: SELECT_FIELDS,
  });
  if (apiKey) {
    params.set("api_key", apiKey);
  }
  return params;
}

/** `https://openalex.org/W123` → `W123`. */
function shortOpenAlexId(id: string): string {
  return id.replace(/^https?:\/\/openalex\.org\//, "");
}

/** `https://doi.org/10.1/x` → `10.1/x`. */
function bareDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;
  return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "") || null;
}

export function workToHit(work: OpenAlexWork): PaperHit | null {
  const title = work.display_name?.trim();
  if (!title) return null;
  const externalId = shortOpenAlexId(work.id);
  const year = work.publication_year ?? null;
  const doi = bareDoi(work.doi);
  const openAccessUrl =
    work.best_oa_location?.pdf_url ?? work.open_access?.oa_url ?? null;
  return {
    source: "openalex",
    externalId,
    title,
    authors: (work.authorships ?? [])
      .map((authorship) => authorship.author?.display_name)
      .filter((name): name is string => Boolean(name)),
    year,
    abstract: decodeAbstract(work.abstract_inverted_index),
    url:
      work.primary_location?.landing_page_url ??
      (doi ? `https://doi.org/${doi}` : `https://openalex.org/${externalId}`),
    citationCount: work.cited_by_count ?? null,
    doi,
    publicationYear: year,
    openAccessUrl,
  };
}

export async function searchOpenAlex(
  query: string,
  { mode = "general", limit = 8 }: { mode?: PaperSearchMode; limit?: number } = {},
): Promise<PaperHit[]> {
  const apiKey = process.env.OPENALEX_API_KEY?.trim() || undefined;
  const params = buildSearchParams(query, mode, limit, apiKey);

  const response = await fetch(`${OPENALEX_WORKS_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `OpenAlex request failed (${response.status}). Try again in a moment.`,
    );
  }

  const body = openAlexResponseSchema.parse(await response.json());
  const hits: PaperHit[] = [];
  for (const raw of body.results) {
    const parsed = openAlexWorkSchema.safeParse(raw);
    if (!parsed.success) continue;
    const hit = workToHit(parsed.data);
    if (hit) hits.push(hit);
  }
  if (mode === "foundational") {
    hits.sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0));
  }
  return hits.slice(0, limit);
}
