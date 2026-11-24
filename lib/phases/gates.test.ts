import { describe, expect, it } from "vitest";

import {
  canEnterFindQuestion,
  evaluateFindQuestionGates,
  evaluateOrientGates,
  isInterestSpecific,
} from "@/lib/phases/gates";
import { emptyProjectState, type Paper } from "@/lib/db/types";

describe("phase gates", () => {
  it("rejects generic interests", () => {
    expect(isInterestSpecific("AI")).toBe(false);
    expect(
      isInterestSpecific("contrastive pretraining for clinical notes"),
    ).toBe(true);
  });

  it("unlocks phase 2 only when orient criteria pass", () => {
    const incomplete = emptyProjectState();
    expect(canEnterFindQuestion(incomplete)).toBe(false);
    expect(evaluateOrientGates(incomplete).some((c) => !c.passed)).toBe(true);

    const ready = {
      ...emptyProjectState(),
      interest: "graph sparsification for GNN explanation",
      background: "I took an ML course and implemented GCN homework.",
      constraints: ["6 weeks, laptop only"],
      candidateQuestions: [
        { id: "1", text: "Does sparsification preserve fidelity?", notes: "" },
        { id: "2", text: "Can we bound explanation stability?", notes: "" },
      ],
    };
    // Everything filled in but the comprehension check not yet passed.
    expect(canEnterFindQuestion(ready)).toBe(false);
    expect(
      evaluateOrientGates(ready).find((c) => !c.passed)?.id,
    ).toBe("orient_check");

    const checked = {
      ...ready,
      milestones: { ...ready.milestones, orient_check: "complete" as const },
    };
    expect(canEnterFindQuestion(checked)).toBe(true);
  });

  it("requires papers and a decision for phase 2", () => {
    const state = {
      ...emptyProjectState(),
      phase: "find_question" as const,
      chosenQuestion: "How does X affect Y in setting Z for undergrads?",
      noveltyClaim: "Prior work studies X but not under noisy labels.",
    };
    const papers = Array.from({ length: 3 }, (_, index) => ({
      id: `p${index}`,
      userId: "u",
      projectId: "pr",
      source: "semantic_scholar" as const,
      externalId: `${index}`,
      title: `Paper ${index}`,
      authors: ["A"],
      year: 2020,
      abstract: null,
      url: null,
      citationCount: null,
      stance: "neutral" as const,
      doi: null,
      publicationYear: 2020,
      openAccessUrl: null,
      createdAt: new Date().toISOString(),
    })) satisfies Paper[];

    expect(
      evaluateFindQuestionGates(state, papers, 0).find((c) => c.id === "decision")
        ?.passed,
    ).toBe(false);
    expect(
      evaluateFindQuestionGates(state, papers, 1).every((c) => c.passed),
    ).toBe(true);
  });
});
