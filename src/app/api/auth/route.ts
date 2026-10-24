import { authInputSchema } from "@/lib/db/schema";
import { handleApiError, jsonError } from "@/lib/api/http";
import { isSupabaseConfigured } from "@/lib/db/repo";
import { getRepo } from "@/lib/db/server";
import {
  clearLocalSessionCookie,
  createLocalUser,
  setLocalSessionCookie,
  verifyLocalUser,
} from "@/lib/auth/local-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const bodySchema = z.discriminatedUnion("mode", [
  authInputSchema.extend({ mode: z.literal("signIn") }),
  authInputSchema.extend({ mode: z.literal("signUp") }),
  z.object({ mode: z.literal("signOut") }),
]);

export async function POST(request: Request) {
  try {
    const json = bodySchema.parse(await request.json());

    if (json.mode === "signOut") {
      if (isSupabaseConfigured()) {
        const supabase = await createSupabaseServerClient();
        await supabase?.auth.signOut();
      } else {
        await clearLocalSessionCookie();
      }
      return Response.json({ ok: true });
    }

    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      if (!supabase) {
        return jsonError("Supabase is not configured.", 500);
      }
      if (json.mode === "signUp") {
        const { error } = await supabase.auth.signUp({
          email: json.email,
          password: json.password,
        });
        if (error) {
          return jsonError(error.message, 400);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: json.email,
          password: json.password,
        });
        if (error) {
          return jsonError(error.message, 400);
        }
      }
      return Response.json({ ok: true });
    }

    const user =
      json.mode === "signUp"
        ? createLocalUser(json.email, json.password)
        : verifyLocalUser(json.email, json.password);
    await setLocalSessionCookie(user.id);
    const repo = await getRepo();
    await repo.upsertProfile({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
    return Response.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
