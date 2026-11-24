import { describe, expect, it } from "vitest";

import {
  buildSearchParams,
  buildSearchQuery,
  decodeAbstract,
  workToHit,
} from "./openalex";

describe("decodeAbstract", () => {
  it("rebuilds text from an inverted index", () => {
    expect(
      decodeAbstract({ the: [0, 3], cat: [1], sat: [2], mat: [4] }),
    ).toBe("the cat sat the mat");
  });

  it("returns null for missing or empty indexes", () => {
    expect(decodeAbstract(null)).toBeNull();
    expect(decodeAbstract(undefined)).toBeNull();
    expect(decodeAbstract({})).toBeNull();
  });

  it("skips gaps in positions", () => {
    expect(decodeAbstract({ a: [0], b: [5] })).toBe("a b");
  });
});

describe("buildSearchQuery / buildSearchParams", () => {
  it("passes general queries through", () => {
    expect(buildSearchQuery("  graph neural nets ", "general")).toBe(
      "graph neural nets",
    );
  });

  it("adds counter-evidence terms for conflicting searches", () => {
    const query = buildSearchQuery("in-context learning", "conflicting");
    expect(query.startsWith('"in-context learning" AND (')).toBe(true);
    expect(query).toContain('"negative results"');
  });

  it("groups long or operator-bearing topics instead of quoting them", () => {
    expect(
      buildSearchQuery("graph neural networks for molecule property prediction", "conflicting"),
    ).toMatch(/^\(graph neural networks for molecule property prediction\) AND \(/);
    expect(buildSearchQuery("rlhf OR dpo", "conflicting")).toMatch(/^\(rlhf OR dpo\) AND/);
  });

  it("pulls a larger pool for foundational reranking", () => {
    const params = buildSearchParams("transformers", "foundational", 5, undefined);
    expect(params.has("sort")).toBe(false);
    expect(params.get("per_page")).toBe("25");
    expect(params.has("api_key")).toBe(false);
  });

  it("includes api_key only when set", () => {
    const params = buildSearchParams("x y", "general", 8, "secret");
    expect(params.get("api_key")).toBe("secret");
    expect(params.has("sort")).toBe(false);
  });
});

describe("workToHit", () => {
  it("maps an OpenAlex work", () => {
    const hit = workToHit({
      id: "https://openalex.org/W123",
      display_name: "Attention Is All You Need",
      publication_year: 2017,
      authorships: [
        { author: { display_name: "Ashish Vaswani" } },
        { author: null },
      ],
      abstract_inverted_index: { Hello: [0], world: [1] },
      cited_by_count: 100,
      doi: "https://doi.org/10.1/abc",
      best_oa_location: { pdf_url: "https://arxiv.org/pdf/1706.03762" },
      primary_location: { landing_page_url: "https://example.org/paper" },
    });
    expect(hit).toEqual({
      source: "openalex",
      externalId: "W123",
      title: "Attention Is All You Need",
      authors: ["Ashish Vaswani"],
      year: 2017,
      abstract: "Hello world",
      url: "https://example.org/paper",
      citationCount: 100,
      doi: "10.1/abc",
      publicationYear: 2017,
      openAccessUrl: "https://arxiv.org/pdf/1706.03762",
    });
  });

  it("drops works without a title", () => {
    expect(workToHit({ id: "https://openalex.org/W1", display_name: null })).toBeNull();
  });
});
