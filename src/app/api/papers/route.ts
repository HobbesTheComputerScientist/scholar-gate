import { requireUser } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/http";
import { savePaperInputSchema } from "@/lib/db/schema";
import { getRepo } from "@/lib/db/server";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = savePaperInputSchema.parse(await request.json());
    const repo = await getRepo();
    const project = await repo.getProject(user.id, input.projectId);
    if (!project) {
      return jsonError("Project not found.", 404);
    }
    const existing = await repo.listPapers(user.id, input.projectId);
    const duplicate = existing.find(
      (row) =>
        row.source === input.source && row.externalId === input.externalId,
    );
    if (duplicate) {
      return Response.json({ paper: duplicate });
    }
    const paper = await repo.insertPaper({
      userId: user.id,
      projectId: input.projectId,
      source: input.source,
      externalId: input.externalId,
      title: input.title,
      authors: input.authors,
      year: input.year ?? null,
      abstract: input.abstract ?? null,
      url: input.url ?? null,
      citationCount: input.citationCount ?? null,
    });
    return Response.json({ paper }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
