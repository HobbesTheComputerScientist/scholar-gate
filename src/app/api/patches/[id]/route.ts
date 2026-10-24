import { requireUser } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/http";
import { patchActionSchema } from "@/lib/db/schema";
import { getRepo } from "@/lib/db/server";
import { applyAcceptedPatch } from "@/lib/patches/apply";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { action } = patchActionSchema.parse(await request.json());
    const repo = await getRepo();
    const patch = await repo.getPatch(user.id, id);
    if (!patch) {
      return jsonError("Patch not found.", 404);
    }
    if (patch.status !== "pending") {
      return jsonError("Patch already resolved.", 400);
    }
    if (action === "rejected") {
      const updated = await repo.setPatchStatus(user.id, id, "rejected");
      return Response.json({ patch: updated });
    }

    const project = await repo.getProject(user.id, patch.projectId);
    if (!project) {
      return jsonError("Project not found.", 404);
    }
    await applyAcceptedPatch(repo, user.id, project, patch);
    const updated = await repo.setPatchStatus(user.id, id, "accepted");
    const nextProject = await repo.getProject(user.id, patch.projectId);
    return Response.json({ patch: updated, project: nextProject });
  } catch (error) {
    return handleApiError(error);
  }
}
