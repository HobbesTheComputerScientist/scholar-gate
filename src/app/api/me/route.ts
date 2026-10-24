import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/db/repo";

export async function GET() {
  const user = await getSessionUser();
  return Response.json({
    user,
    persistence: isSupabaseConfigured() ? "supabase" : "local",
  });
}
