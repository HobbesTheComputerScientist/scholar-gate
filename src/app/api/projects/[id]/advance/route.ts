import { requireUser } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/http";
import { getRepo } from "@/lib/db/server";
import {
  canEnterFindQuestion,
  evaluateFindQuestionGates,
  evaluateOrientGates,
} from "@/lib/phases/gates";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const repo = await getRepo();
    const project = await repo.getProject(user.id, id);
    if (!project) {
      return jsonError("Project not found.", 404);
    }

    if (project.state.phase === "orient") {
      const checks = evaluateOrientGates(project.state);
      if (!canEnterFindQuestion(project.state)) {
        return Response.json(
          { error: "Orient exit criteria are not met.", checks },
          { status: 400 },
        );
      }
      // The orient_checks table is the source of truth for the comprehension gate.
      const orientChecks = await repo.listOrientChecks(user.id, id);
      if (!orientChecks.some((check) => check.passed)) {
        return Response.json(
          { error: "Pass the Orient comprehension check first.", checks },
          { status: 400 },
        );
      }
      const updated = await repo.updateProjectState(user.id, id, {
        ...project.state,
        phase: "find_question",
      });
      return Response.json({ project: updated, checks });
    }

    const papers = await repo.listPapers(user.id, id);
    const decisions = await repo.listDecisions(user.id, id);
    const checks = evaluateFindQuestionGates(
      project.state,
      papers,
      decisions.length,
    );
    return Response.json({
      project,
      checks,
      complete: checks.every((check) => check.passed),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
