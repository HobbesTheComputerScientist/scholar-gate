import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/http";
import { orientCheckSubmitSchema } from "@/lib/db/schema";
import { getRepo } from "@/lib/db/server";
import {
  generateOrientCheckQuestions,
  gradeOrientCheckWithAI,
} from "@/lib/orient/ai-check";
import type { OrientCheck } from "@/lib/db/types";
import { isInterestSpecific } from "@/lib/phases/gates";

type Ctx = { params: Promise<{ id: string }> };

/** Rubrics hold the expected key points; never send them to the browser. */
function forClient(check: OrientCheck) {
  return {
    ...check,
    questions: check.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      hint: question.hint,
      kind: question.kind,
    })),
  };
}

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  orientCheckSubmitSchema.extend({ action: z.literal("submit") }),
]);

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const repo = await getRepo();
    const project = await repo.getProject(user.id, id);
    if (!project) {
      return jsonError("Project not found.", 404);
    }
    const checks = await repo.listOrientChecks(user.id, id);
    return Response.json({ checks: checks.map(forClient) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const repo = await getRepo();
    const project = await repo.getProject(user.id, id);
    if (!project) {
      return jsonError("Project not found.", 404);
    }
    if (project.state.phase !== "orient") {
      return jsonError("The comprehension check belongs to Orient.", 400);
    }

    const input = postSchema.parse(await request.json());

    if (input.action === "start") {
      if (!isInterestSpecific(project.state.interest)) {
        return jsonError(
          "Set a specific topic in the Project Brain before taking the check.",
          400,
        );
      }
      const recent = await repo.listRecentMessages(user.id, id, 12);
      const { questions, source } = await generateOrientCheckQuestions(
        project.state,
        recent,
      );
      const check = await repo.insertOrientCheck({
        userId: user.id,
        projectId: id,
        topic: project.state.interest.trim(),
        questions,
        studentAnswers: [],
        score: 0,
        passed: false,
      });
      return Response.json(
        { check: forClient(check), source },
        { status: 201 },
      );
    }

    const existing = await repo.getOrientCheck(user.id, input.checkId);
    if (!existing || existing.projectId !== id) {
      return jsonError("Orient check not found.", 404);
    }
    if (existing.studentAnswers.length > 0) {
      return jsonError("This check was already submitted. Start a new one.", 400);
    }

    const grade = await gradeOrientCheckWithAI(
      existing.questions,
      input.answers,
      project.state,
    );
    const check = await repo.gradeOrientCheck(user.id, existing.id, {
      studentAnswers: input.answers,
      score: grade.score,
      passed: grade.passed,
    });

    let updatedProject = project;
    if (grade.passed && project.state.milestones.orient_check !== "complete") {
      updatedProject = await repo.updateProjectState(user.id, id, {
        ...project.state,
        milestones: { ...project.state.milestones, orient_check: "complete" },
      });
    }

    return Response.json({
      check: forClient(check),
      perQuestion: grade.perQuestion,
      gradedBy: grade.gradedBy,
      project: updatedProject,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
