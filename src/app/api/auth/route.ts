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

function sessionUser(
  user: { id: string; email?: string | null } | null,
) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: user.email?.split("@")[0] ?? null,
  };
}

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
        const { data, error } = await supabase.auth.signUp({
          email: json.email,
          password: json.password,
          options: { emailRedirectTo: new URL("/", request.url).toString() },
        });
        if (error) {
          return jsonError(error.message, 400);
        }
        if (!data.session) {
          // Email confirmation is on: no session until the link is clicked.
          return Response.json({ ok: true, needsConfirmation: true });
        }
        return Response.json({ ok: true, user: sessionUser(data.user) });
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: json.email,
        password: json.password,
      });
      if (error) {
        return jsonError(
          error.code === "email_not_confirmed"
            ? "Confirm your email first: open the link we sent you, then sign in."
            : error.message,
          400,
        );
      }
      return Response.json({ ok: true, user: sessionUser(data.user) });
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
