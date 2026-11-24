import { getSessionUser } from "@/lib/auth/session";
import { getPersistence, type Persistence } from "@/lib/db/server";

export async function GET() {
  let persistence: Persistence = "local";
  try {
    persistence = await getPersistence();
    const user = await getSessionUser();
    return Response.json({ user, persistence });
  } catch (error) {
    return Response.json(
      {
        user: null,
        persistence,
        error:
          error instanceof Error ? error.message : "Could not read session.",
      },
      { status: 500 },
    );
  }
}
