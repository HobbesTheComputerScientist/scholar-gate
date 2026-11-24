import { searchOpenAlex, type PaperHit } from "@/lib/papers/openalex";

/** Max readings shown under one coach reply. */
const MAX_READINGS = 6;

/**
 * Turns the coach's search queries into REAL papers from OpenAlex. The coach
 * never writes titles itself; only these results are shown as readings.
 */
export async function findReadings(queries: string[]): Promise<PaperHit[]> {
  const results = await Promise.all(
    queries.slice(0, 3).map((query) =>
      searchOpenAlex(query, { mode: "foundational", limit: 3 }).catch(
        () => [] as PaperHit[],
      ),
    ),
  );
  const seen = new Set<string>();
  const hits: PaperHit[] = [];
  for (const hit of results.flat()) {
    if (seen.has(hit.externalId)) continue;
    seen.add(hit.externalId);
    hits.push(hit);
    if (hits.length >= MAX_READINGS) break;
  }
  return hits;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([[\]*_`])/g, "\\$1");
}

/** Markdown block appended to the coach's reply (and stored with it). */
export function formatReadings(queries: string[], hits: PaperHit[]): string {
  if (hits.length === 0) {
    return `\n\n---\n**Readings:** I searched OpenAlex for ${queries
      .map((q) => `"${q}"`)
      .join(", ")} but found nothing useful. Try the Literature panel with your own keywords.`;
  }
  const lines = hits.map((hit) => {
    const authors =
      hit.authors.slice(0, 3).join(", ") + (hit.authors.length > 3 ? " et al." : "");
    const link = hit.openAccessUrl ?? hit.url;
    const title = escapeMarkdown(hit.title);
    const meta = [authors, hit.year, hit.citationCount != null ? `${hit.citationCount.toLocaleString("en-US")} citations` : null]
      .filter(Boolean)
      .join(" · ");
    return `- ${link ? `[${title}](${link})` : title} — ${meta}${
      hit.openAccessUrl ? " · free to read" : ""
    }`;
  });
  return `\n\n---\n**Readings to learn from** (real papers found on OpenAlex for ${queries
    .map((q) => `"${q}"`)
    .join(", ")}; save the ones you read from the Literature panel):\n${lines.join("\n")}`;
}
