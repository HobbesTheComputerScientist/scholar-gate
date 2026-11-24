import type {
  OrientCheckAnswer,
  OrientCheckQuestion,
  ProjectState,
} from "@/lib/db/types";

/** Percent (0–100) a student needs to enter Phase 2. */
export const ORIENT_CHECK_PASS_SCORE = 75;

/** Minimum words for an answer to count as a genuine explanation. */
export const MIN_ANSWER_WORDS = 25;

/**
 * Builds comprehension questions from the student's own Brain. Pure and
 * deterministic: no model call, no model-written answers.
 */
export function buildOrientCheckQuestions(
  state: ProjectState,
): OrientCheckQuestion[] {
  const topic = state.interest.trim();
  const questions: OrientCheckQuestion[] = [
    {
      id: "problem",
      prompt: `In your own words, what is the core problem in "${topic}", and why does it matter?`,
      rubric:
        "Names a concrete problem (not just the field) and gives a reason someone would care.",
    },
    {
      id: "concept",
      prompt:
        "Name one key concept, method, or dataset someone must understand to work on this topic. Explain it as you would to a classmate.",
      rubric:
        "Identifies a specific concept/method and explains how it works, not just its name.",
    },
  ];

  const candidate = state.candidateQuestions.find(
    (q) => q.text.trim().length > 0,
  );
  questions.push(
    candidate
      ? {
          id: "candidate",
          prompt: `Take your candidate question: "${candidate.text.trim()}". What would you need to measure or compare to answer it?`,
          rubric:
            "Describes an observable quantity or comparison that would answer the question.",
        }
      : {
          id: "candidate",
          prompt:
            "Describe one question in this area you could plausibly answer, and what you would measure or compare to answer it.",
          rubric:
            "States a question and an observable quantity or comparison that would answer it.",
        },
  );

  const constraints = state.constraints.filter((c) => c.trim().length > 0);
  questions.push({
    id: "constraints",
    prompt: constraints.length
      ? `Which of your constraints (${constraints.join("; ")}) most limits what you can study, and how does it change your scope?`
      : "What is the biggest practical limit on your project (time, compute, data, advisor), and how does it change your scope?",
    rubric: "Links a specific constraint to a concrete change in scope.",
  });

  return questions;
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function countWords(text: string): number {
  return words(text).length;
}

/** Share of the answer's words that also appear in `source`. */
function overlap(answer: string, source: string): number {
  const answerWords = words(answer);
  if (answerWords.length === 0) return 0;
  const sourceWords = new Set(words(source));
  return (
    answerWords.filter((word) => sourceWords.has(word)).length /
    answerWords.length
  );
}

export type OrientCheckGrade = {
  score: number;
  passed: boolean;
  perQuestion: { questionId: string; passed: boolean; reason: string }[];
};

/**
 * Heuristic grader (MVP stub): an answer counts when it is long enough and is
 * not mostly a copy of the question or of text already in the Brain.
 */
export function gradeOrientCheck(
  questions: OrientCheckQuestion[],
  answers: OrientCheckAnswer[],
  state: ProjectState,
): OrientCheckGrade {
  const brainText = [
    state.interest,
    state.background,
    ...state.constraints,
    ...state.candidateQuestions.map((q) => q.text),
  ].join(" ");

  const perQuestion = questions.map((question) => {
    const answer =
      answers.find((a) => a.questionId === question.id)?.answer.trim() ?? "";
    if (words(answer).length < MIN_ANSWER_WORDS) {
      return {
        questionId: question.id,
        passed: false,
        reason: `Explain in at least ${MIN_ANSWER_WORDS} words.`,
      };
    }
    if (overlap(answer, `${question.prompt} ${brainText}`) > 0.8) {
      return {
        questionId: question.id,
        passed: false,
        reason: "Mostly repeats the question or your Brain; explain it in new words.",
      };
    }
    return { questionId: question.id, passed: true, reason: "OK" };
  });

  const passedCount = perQuestion.filter((q) => q.passed).length;
  const score =
    questions.length === 0
      ? 0
      : Math.round((passedCount / questions.length) * 10000) / 100;
  return {
    score,
    passed: score >= ORIENT_CHECK_PASS_SCORE,
    perQuestion,
  };
}
