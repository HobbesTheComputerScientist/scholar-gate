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
  stance: "foundational",
  doi: "10.48550/arXiv.1706.03762",
  publicationYear: 2017,
  openAccessUrl: null,
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

  it("tracks milestones, takeaways, gaps, and conflicts from the Brain", () => {
    const state = {
      ...emptyProjectState(),
      phase: "find_question" as const,
      milestones: {
        ...emptyProjectState().milestones,
        orient_foundations: "complete" as const,
        orient_check: "complete" as const,
        broad_ideation: "complete" as const,
        literature_discussion: "in_progress" as const,
      },
      studentTakeaways: ["Attention replaces recurrence for sequence modeling."],
      identifiedGaps: ["No study of low-resource grading rubrics."],
      conflictingEvidenceNotes: ["Paper A and B disagree on rubric transfer."],
    };
    const assembled = assemblePrompt({
      projectName: "Milestones",
      state,
      papers: [paper],
      decisions: [],
      latestSummary: null,
      recentMessages: [],
      userMessage: "What next?",
    });

    expect(assembled.system).toContain("[x] P1 orient_check");
    expect(assembled.system).toContain(
      "[~] P2 literature_discussion: Discuss saved literature  <- current",
    );
    expect(assembled.system).toContain("Current milestone focus (literature_discussion)");
    expect(assembled.system).toContain("Attention replaces recurrence");
    expect(assembled.system).toContain("No study of low-resource grading rubrics.");
    expect(assembled.system).toContain("Paper A and B disagree");
    expect(assembled.system).toContain("stance=foundational");
    expect(assembled.system).toContain("doi=10.48550/arXiv.1706.03762");
    expect(assembled.system).toContain("student's own words");
    expect(assembled.system).toContain("Do NOT ghostwrite");
  });
});
