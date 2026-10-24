import type { Paper, ProjectState } from "@/lib/db/types";

export type GateCheck = {
  id: string;
  label: string;
  passed: boolean;
};

const GENERIC_INTERESTS = new Set([
  "ai",
  "ml",
  "machine learning",
  "artificial intelligence",
  "cs",
  "computer science",
  "research",
  "deep learning",
]);

export function isInterestSpecific(interest: string): boolean {
  const trimmed = interest.trim();
  if (trimmed.length < 12) {
    return false;
  }
  return !GENERIC_INTERESTS.has(trimmed.toLowerCase());
}

export function evaluateOrientGates(state: ProjectState): GateCheck[] {
  return [
    {
      id: "interest",
      label: "Specific topic area (not a one-word field like “AI”)",
      passed: isInterestSpecific(state.interest),
    },
    {
      id: "background",
      label: "Background: what you already know",
      passed: state.background.trim().length >= 20,
    },
    {
      id: "constraints",
      label: "At least one constraint (time, compute, data, advisor)",
      passed: state.constraints.some((item) => item.trim().length > 0),
    },
    {
      id: "candidates",
      label: "At least two candidate research questions",
      passed: state.candidateQuestions.filter((q) => q.text.trim().length > 0)
        .length >= 2,
    },
  ];
}

export function evaluateFindQuestionGates(
  state: ProjectState,
  papers: Paper[],
  decisionCount: number,
): GateCheck[] {
  return [
    {
      id: "question",
      label: "Concrete, answerable research question",
      passed: (state.chosenQuestion ?? "").trim().length >= 20,
    },
    {
      id: "novelty",
      label: "Novelty / gap claim relative to saved papers",
      passed: (state.noveltyClaim ?? "").trim().length >= 20,
    },
    {
      id: "papers",
      label: "At least three papers saved on this project",
      passed: papers.length >= 3,
    },
    {
      id: "decision",
      label: "Logged decision explaining why this question",
      passed: decisionCount >= 1,
    },
  ];
}

export function allPassed(checks: GateCheck[]): boolean {
  return checks.every((check) => check.passed);
}

export function canEnterFindQuestion(state: ProjectState): boolean {
  return allPassed(evaluateOrientGates(state));
}

export function isFindQuestionComplete(
  state: ProjectState,
  papers: Paper[],
  decisionCount: number,
): boolean {
  return allPassed(evaluateFindQuestionGates(state, papers, decisionCount));
}
