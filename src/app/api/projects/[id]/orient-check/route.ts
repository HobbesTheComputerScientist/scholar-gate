import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/http";
import { orientCheckSubmitSchema } from "@/lib/db/schema";
import { getRepo } from "@/lib/db/server";
import {
  buildOrientCheckQuestions,
  gradeOrientCheck,
} from "@/lib/orient/check";
import { isInterestSpecific } from "@/lib/phases/gates";

type Ctx = { params: Promise<{ id: string }> };

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
    return Response.json({ checks });
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
      const check = await repo.insertOrientCheck({
        userId: user.id,
        projectId: id,
        topic: project.state.interest.trim(),
        questions: buildOrientCheckQuestions(project.state),
        studentAnswers: [],
        score: 0,
        passed: false,
      });
      return Response.json({ check }, { status: 201 });
    }

    const existing = await repo.getOrientCheck(user.id, input.checkId);
    if (!existing || existing.projectId !== id) {
      return jsonError("Orient check not found.", 404);
    }
    if (existing.studentAnswers.length > 0) {
      return jsonError("This check was already submitted. Start a new one.", 400);
    }

    const grade = gradeOrientCheck(
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
      check,
      perQuestion: grade.perQuestion,
      project: updatedProject,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
