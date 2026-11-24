import { describe, expect, it } from "vitest";

import { parseProjectState, updateStatePayloadSchema } from "@/lib/db/schema";
import { applyStatePatch } from "@/lib/patches/apply";
import { emptyProjectState } from "@/lib/db/types";

describe("Project Brain schema", () => {
  it("keeps pre-upgrade Brain rows instead of resetting them", () => {
    const legacy = {
      phase: "find_question",
      interest: "graph sparsification for GNN explanation",
      background: "Took an ML course.",
      experienceLevel: "intermediate",
      constraints: ["6 weeks"],
      candidateQuestions: [],
      chosenQuestion: null,
      noveltyClaim: null,
      openQuestions: [],
    };
    const parsed = parseProjectState(legacy);
    expect(parsed.interest).toBe(legacy.interest);
    expect(parsed.phase).toBe("find_question");
    expect(parsed.milestones.gap_analysis).toBe("not_started");
    expect(parsed.studentTakeaways).toEqual([]);
    expect(parsed.identifiedGaps).toEqual([]);
    expect(parsed.conflictingEvidenceNotes).toEqual([]);
  });

  it("does not let patches set the server-owned orient_check milestone", () => {
    expect(
      updateStatePayloadSchema.safeParse({
        milestones: { orient_check: "complete" },
      }).success,
    ).toBe(false);
  });

  it("merges partial milestone patches", () => {
    const next = applyStatePatch(emptyProjectState(), {
      milestones: { broad_ideation: "in_progress" },
      identifiedGaps: ["No work on noisy labels"],
    });
    expect(next.milestones.broad_ideation).toBe("in_progress");
    expect(next.milestones.orient_foundations).toBe("not_started");
    expect(next.identifiedGaps).toEqual(["No work on noisy labels"]);
  });
});
