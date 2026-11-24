import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/http";
import { updatePaperStanceInputSchema } from "@/lib/db/schema";
import { getRepo } from "@/lib/db/server";

type Ctx = { params: Promise<{ id: string }> };

/** Student tags a saved paper as supporting / conflicting / foundational / neutral. */
export async function PATCH(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { stance } = updatePaperStanceInputSchema.parse(await request.json());
    const repo = await getRepo();
    const paper = await repo.updatePaperStance(user.id, id, stance);
    return Response.json({ paper });
  } catch (error) {
    return handleApiError(error);
  }
}
