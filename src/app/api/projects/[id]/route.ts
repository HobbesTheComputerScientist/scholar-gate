import { requireUser } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/http";
import { projectStatePatchSchema } from "@/lib/db/schema";
import { getRepo } from "@/lib/db/server";
import { applyStatePatch } from "@/lib/patches/apply";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const repo = await getRepo();
    const project = await repo.getProject(user.id, id);
    if (!project) {
      return jsonError("Project not found.", 404);
    }
    const [papers, decisions, messages, patches, summary] = await Promise.all([
      repo.listPapers(user.id, id),
      repo.listDecisions(user.id, id),
      repo.listRecentMessages(user.id, id, 100),
      repo.listPendingPatches(user.id, id),
      repo.latestSummary(user.id, id),
    ]);
    return Response.json({
      project,
      papers,
      decisions,
      messages,
      patches,
      latestSummary: summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const repo = await getRepo();
    const project = await repo.getProject(user.id, id);
    if (!project) {
      return jsonError("Project not found.", 404);
    }
    const payload = projectStatePatchSchema.parse(await request.json());
    const next = applyStatePatch(project.state, payload);
    const updated = await repo.updateProjectState(user.id, id, next);
    return Response.json({ project: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const repo = await getRepo();
    await repo.deleteProject(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
