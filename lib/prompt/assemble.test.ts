import { describe, expect, it } from "vitest";

import { assemblePrompt } from "@/lib/prompt/assemble";
import { emptyProjectState, type Paper } from "@/lib/db/types";

const paper: Paper = {
  id: "paper-1",
  userId: "user-1",
  projectId: "proj-1",
  source: "semantic_scholar",
  externalId: "abc",
  title: "Attention Is All You Need",
  authors: ["Vaswani"],
  year: 2017,
  abstract: null,
  url: "https://example.com",
  citationCount: 100,
  createdAt: new Date().toISOString(),
};

describe("assemblePrompt", () => {
  it("is a pure function of project state and allowed papers", () => {
    const state = {
      ...emptyProjectState(),
      interest: "retrieval-augmented grading of short answers",
    };
    const input = {
      projectName: "Demo",
      state,
      papers: [paper],
      decisions: [],
      latestSummary: "Student is exploring RAG for grading.",
      recentMessages: [
        { role: "user" as const, content: "I care about education NLP." },
      ],
      userMessage: "What should I read?",
    };

    const first = assemblePrompt(input);
    const second = assemblePrompt(input);

    expect(first).toEqual(second);
    expect(first.system).toContain("Attention Is All You Need");
    expect(first.system).toContain("Allowed papers");
    expect(first.system).toContain("Never invent");
    expect(first.system).toContain("Do NOT ghostwrite");
    expect(first.system).not.toContain("Write the Introduction");
    expect(first.user).toContain("What should I read?");
    expect(first.user).toContain("Brain above is authoritative");
  });

  it("refuses citations when the papers table is empty", () => {
    const assembled = assemblePrompt({
      projectName: "Empty",
      state: emptyProjectState(),
      papers: [],
      decisions: [],
      latestSummary: null,
      recentMessages: [],
      userMessage: "Cite the famous BERT paper.",
    });

    expect(assembled.system).toContain("(none — you must not cite any paper)");
    expect(assembled.system).toContain("Phase 1: Orient");
  });
});
