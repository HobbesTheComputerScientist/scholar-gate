import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/http";
import { createProjectInputSchema } from "@/lib/db/schema";
import { getRepo } from "@/lib/db/server";
import { emptyProjectState } from "@/lib/db/types";

export async function GET() {
  try {
    const user = await requireUser();
    const repo = await getRepo();
    const projects = await repo.listProjects(user.id);
    return Response.json({ projects });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createProjectInputSchema.parse(await request.json());
    const repo = await getRepo();
    const state = {
      ...emptyProjectState(input.experienceLevel),
      interest: input.interest,
    };
    const project = await repo.createProject({
      userId: user.id,
      name: input.name,
      state,
    });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
