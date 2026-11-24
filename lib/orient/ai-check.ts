import { z } from "zod";

import { GeminiUnavailableError, generateWithFallback } from "@/lib/ai/gemini";
import type {
  ChatMessage,
  OrientCheckAnswer,
  OrientCheckQuestion,
  ProjectState,
} from "@/lib/db/types";
import { EXPERIENCE_LEVEL_LABELS } from "@/lib/db/types";
import {
  MIN_ANSWER_WORDS,
  ORIENT_CHECK_PASS_SCORE,
  buildOrientCheckQuestions,
  gradeOrientCheck,
  type OrientCheckGrade,
} from "@/lib/orient/check";

/**
 * Comprehension check backed by Gemini: questions test the SUBJECT MATTER of
 * the student's topic (not just their plan), and answers are graded against a
 * hidden rubric. Falls back to the deterministic check when Gemini is down.
 */

const SUBJECT_QUESTIONS = 3;

const generatedSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().trim().min(10),
        rubric: z.string().trim().min(10),
        hint: z.string().trim().optional(),
      }),
    )
    .min(SUBJECT_QUESTIONS),
});

const gradedSchema = z.object({
  results: z.array(
    z.object({
      questionId: z.string(),
      score: z.number().min(0).max(100),
      feedback: z.string().trim().min(1),
    }),
  ),
});

function context(state: ProjectState, recent: Pick<ChatMessage, "role" | "content">[]) {
  const taught = recent
    .filter((m) => m.role === "assistant")
    .map((m) => m.content.slice(0, 1500))
    .join("\n---\n");
  return [
    `Topic: ${state.interest}`,
    `Experience level: ${EXPERIENCE_LEVEL_LABELS[state.experienceLevel]}`,
    `Background: ${state.background || "(not given)"}`,
    `Candidate questions: ${
      state.candidateQuestions.map((q) => q.text).join(" | ") || "(none)"
    }`,
    taught ? `What the coach has taught so far:\n${taught}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function parseJson(text: string | undefined): unknown {
  if (!text) return null;
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(trimmed);
}

/**
 * 3 subject-matter questions from Gemini + 1 project question about the
 * student's own candidate question. Deterministic fallback if Gemini fails.
 */
export async function generateOrientCheckQuestions(
  state: ProjectState,
  recent: Pick<ChatMessage, "role" | "content">[],
): Promise<{ questions: OrientCheckQuestion[]; source: "ai" | "template" }> {
  const template = buildOrientCheckQuestions(state);
  const projectQuestion: OrientCheckQuestion = {
    ...(template.find((q) => q.id === "candidate") ?? template[0]),
    hint: "Name what you would observe, measure, or compare.",
    kind: "project",
  };

  try {
    const { response } = await generateWithFallback({
      contents: context(state, recent),
      config: {
        systemInstruction: `You write comprehension-check questions for an undergraduate who is learning the subject matter of their research topic before choosing a research question.

Write exactly ${SUBJECT_QUESTIONS} questions that test real understanding of the SUBJECT MATTER of the topic (core concepts, mechanisms, key methods or evidence in the field), pitched at the student's experience level:
1. Explain a core concept or mechanism in their own words.
2. Apply it: predict or reason about what happens in a concrete scenario from the field.
3. Compare or critique: contrast two related ideas/methods, or explain a limitation or common misconception.
Prefer concepts the coach has already taught, when given. Questions must be answerable in 3-6 sentences without looking anything up, and must not be answerable by restating the question.

For each question give:
- prompt: the question.
- rubric: the 2-4 key points a correct answer must contain (hidden from the student; used for grading).
- hint: a short nudge on what to think about, WITHOUT giving the answer.
Return JSON only.`,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              minItems: SUBJECT_QUESTIONS,
              maxItems: SUBJECT_QUESTIONS,
              items: {
                type: "object",
                properties: {
                  prompt: { type: "string" },
                  rubric: { type: "string" },
                  hint: { type: "string" },
                },
                required: ["prompt", "rubric", "hint"],
              },
            },
          },
          required: ["questions"],
        },
        maxOutputTokens: 4096,
      },
    });
    const parsed = generatedSchema.parse(parseJson(response.text));
    const subject: OrientCheckQuestion[] = parsed.questions
      .slice(0, SUBJECT_QUESTIONS)
      .map((q, index) => ({
        id: `subject-${index + 1}`,
        prompt: q.prompt,
        rubric: q.rubric,
        hint: q.hint,
        kind: "subject",
      }));
    return { questions: [...subject, projectQuestion], source: "ai" };
  } catch (error) {
    if (!(error instanceof GeminiUnavailableError) && !(error instanceof z.ZodError) && !(error instanceof SyntaxError)) {
      console.error("[orient-check] question generation failed:", error);
    }
    return {
      questions: template.map((q) => ({ ...q, hint: q.rubric })),
      source: "template",
    };
  }
}

export type AiOrientCheckGrade = OrientCheckGrade & {
  perQuestion: {
    questionId: string;
    passed: boolean;
    reason: string;
    score: number;
  }[];
  gradedBy: "ai" | "heuristic";
};

/**
 * Heuristic gate first (length, not copied), then Gemini scores each answer
 * against its hidden rubric. Overall score is the mean; 75+ passes.
 */
export async function gradeOrientCheckWithAI(
  questions: OrientCheckQuestion[],
  answers: OrientCheckAnswer[],
  state: ProjectState,
): Promise<AiOrientCheckGrade> {
  const heuristic = gradeOrientCheck(questions, answers, state);
  const heuristicRows = heuristic.perQuestion.map((row) => ({
    ...row,
    score: row.passed ? 100 : 0,
  }));

  // Only send answers that pass the basic effort gate to the model.
  const toGrade = questions.filter(
    (q) => heuristic.perQuestion.find((row) => row.questionId === q.id)?.passed,
  );
  if (toGrade.length === 0) {
    return { ...heuristic, perQuestion: heuristicRows, gradedBy: "heuristic" };
  }

  try {
    const payload = toGrade.map((q) => ({
      questionId: q.id,
      question: q.prompt,
      rubric: q.rubric,
      answer: answers.find((a) => a.questionId === q.id)?.answer ?? "",
    }));
    const { response } = await generateWithFallback({
      contents: JSON.stringify({ topic: state.interest, items: payload }),
      config: {
        systemInstruction: `You grade an undergraduate's comprehension-check answers about their research topic (experience level: ${EXPERIENCE_LEVEL_LABELS[state.experienceLevel]}).
For each item, score 0-100 for how well the answer demonstrates understanding of the rubric's key points (accuracy matters more than wording; partial credit is fine; an answer that is vague, wrong, or off-topic scores low).
Give 1-3 sentences of specific, encouraging feedback: what was right, what was missing or wrong, and what to review. Do NOT reveal a full model answer.
Return JSON only.`,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  questionId: { type: "string" },
                  score: { type: "number" },
                  feedback: { type: "string" },
                },
                required: ["questionId", "score", "feedback"],
              },
            },
          },
          required: ["results"],
        },
        maxOutputTokens: 4096,
      },
    });
    const graded = gradedSchema.parse(parseJson(response.text));

    const perQuestion = questions.map((q) => {
      const gate = heuristic.perQuestion.find((row) => row.questionId === q.id);
      if (!gate?.passed) {
        return { questionId: q.id, passed: false, reason: gate?.reason ?? "Not answered.", score: 0 };
      }
      const result = graded.results.find((row) => row.questionId === q.id);
      if (!result) {
        // Model skipped it: fall back to the effort gate for this one.
        return { questionId: q.id, passed: true, reason: "Counted.", score: ORIENT_CHECK_PASS_SCORE };
      }
      const score = Math.round(result.score);
      return {
        questionId: q.id,
        passed: score >= ORIENT_CHECK_PASS_SCORE,
        reason: result.feedback,
        score,
      };
    });
    const score =
      Math.round(
        (perQuestion.reduce((sum, row) => sum + row.score, 0) / perQuestion.length) * 100,
      ) / 100;
    return {
      score,
      passed: score >= ORIENT_CHECK_PASS_SCORE,
      perQuestion,
      gradedBy: "ai",
    };
  } catch (error) {
    if (!(error instanceof GeminiUnavailableError)) {
      console.error("[orient-check] AI grading failed:", error);
    }
    return { ...heuristic, perQuestion: heuristicRows, gradedBy: "heuristic" };
  }
}

export { MIN_ANSWER_WORDS };
