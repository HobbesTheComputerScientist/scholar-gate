import { describe, expect, it } from "vitest";

import { formatReadings } from "@/lib/ai/readings";
import {
  recommendReadingsPayloadSchema,
  updateProfilePayloadSchema,
} from "@/lib/db/schema";
import type { PaperHit } from "@/lib/papers/openalex";

const hit: PaperHit = {
  source: "openalex",
  externalId: "W1",
  title: "Coral [reef] recovery",
  authors: ["A", "B", "C", "D"],
  year: 2020,
  abstract: null,
  url: "https://example.org/w1",
  citationCount: 1234,
  doi: null,
  publicationYear: 2020,
  openAccessUrl: null,
};

describe("formatReadings", () => {
  it("lists only the real hits with links and metadata", () => {
    const block = formatReadings(["coral recovery review"], [hit]);
    expect(block).toContain("[Coral \\[reef\\] recovery](https://example.org/w1)");
    expect(block).toContain("A, B, C et al.");
    expect(block).toContain("1,234 citations");
    expect(block).toContain('"coral recovery review"');
  });

  it("says so when nothing was found", () => {
    expect(formatReadings(["x y"], [])).toContain("found nothing useful");
  });
});

describe("coach tool schemas", () => {
  it("accepts profile fields and rejects unknown or empty payloads", () => {
    expect(
      updateProfilePayloadSchema.parse({ background: "Took intro bio", constraints: ["10 weeks"] }),
    ).toEqual({ background: "Took intro bio", constraints: ["10 weeks"] });
    expect(() => updateProfilePayloadSchema.parse({})).toThrow();
    expect(() => updateProfilePayloadSchema.parse({ phase: "find_question" })).toThrow();
  });

  it("limits reading queries to 1-3", () => {
    expect(() => recommendReadingsPayloadSchema.parse({ queries: [] })).toThrow();
    expect(() =>
      recommendReadingsPayloadSchema.parse({ queries: ["a b", "c d", "e f", "g h"] }),
    ).toThrow();
  });
});
