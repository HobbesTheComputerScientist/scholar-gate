export type ScholarHit = {
  source: "semantic_scholar";
  externalId: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
  url: string | null;
  citationCount: number | null;
};

type S2Paper = {
  paperId?: string;
  title?: string;
  year?: number;
  abstract?: string;
  url?: string;
  citationCount?: number;
  authors?: Array<{ name?: string }>;
  externalIds?: { ArXiv?: string; DOI?: string };
};

export async function searchSemanticScholar(
  query: string,
  limit = 8,
): Promise<ScholarHit[]> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: "title,authors,year,abstract,url,citationCount,externalIds",
  });
  const headers: HeadersInit = { Accept: "application/json" };
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const response = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error(
      `Semantic Scholar request failed (${response.status}). Try again in a moment.`,
    );
  }

  const body = (await response.json()) as { data?: S2Paper[] };
  return (body.data ?? [])
    .filter((paper) => paper.paperId && paper.title)
    .map((paper) => ({
      source: "semantic_scholar" as const,
      externalId: paper.paperId as string,
      title: paper.title as string,
      authors: (paper.authors ?? [])
        .map((author) => author.name)
        .filter((name): name is string => Boolean(name)),
      year: paper.year ?? null,
      abstract: paper.abstract ?? null,
      url: paper.url ?? null,
      citationCount: paper.citationCount ?? null,
    }));
}
