import { describe, expect, it } from "vitest";

import { emptyProjectState } from "@/lib/db/types";
import {
  ORIENT_CHECK_PASS_SCORE,
  buildOrientCheckQuestions,
  gradeOrientCheck,
} from "@/lib/orient/check";

const state = {
  ...emptyProjectState(),
  interest: "retrieval-augmented grading of short answers",
  constraints: ["8 weeks", "no GPU cluster"],
  candidateQuestions: [
    { id: "c1", text: "Does retrieval improve rubric agreement?", notes: "" },
  ],
};

const longAnswer = (seed: string) =>
  `${seed} because graders disagree when rubrics are vague, so a system that retrieves similar scored examples could anchor judgments, and I would compare agreement with teachers across several datasets and prompt formats over time.`;

describe("orient comprehension check", () => {
  it("builds questions from the student's own Brain", () => {
    const questions = buildOrientCheckQuestions(state);
    expect(questions.map((q) => q.id)).toEqual([
      "problem",
      "concept",
      "candidate",
      "constraints",
    ]);
    expect(questions[0].prompt).toContain(state.interest);
    expect(questions[2].prompt).toContain("Does retrieval improve rubric agreement?");
    expect(questions[3].prompt).toContain("no GPU cluster");
  });

  it("passes thoughtful answers and fails short or copied ones", () => {
    const questions = buildOrientCheckQuestions(state);
    const good = gradeOrientCheck(
      questions,
      questions.map((q) => ({ questionId: q.id, answer: longAnswer(q.id) })),
      state,
    );
    expect(good.score).toBe(100);
    expect(good.passed).toBe(true);

    const weak = gradeOrientCheck(
      questions,
      [
        { questionId: "problem", answer: "It matters." },
        { questionId: "concept", answer: questions[1].prompt },
        { questionId: "candidate", answer: longAnswer("x") },
      ],
      state,
    );
    expect(weak.score).toBe(25);
    expect(weak.score).toBeLessThan(ORIENT_CHECK_PASS_SCORE);
    expect(weak.passed).toBe(false);
  });
});
