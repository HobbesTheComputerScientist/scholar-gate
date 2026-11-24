import { isSupabaseConfigured } from "@/lib/db/repo";
import { getRepo } from "@/lib/db/server";
import {
  getLocalUser,
  readLocalUserId,
} from "@/lib/auth/local-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db/types";

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return null;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    const fallback: SessionUser = {
      id: data.user.id,
      email: data.user.email ?? null,
      displayName:
        (data.user.user_metadata?.display_name as string | undefined) ??
        data.user.email?.split("@")[0] ??
        null,
    };
    // The auth session is the source of truth for "signed in". A profiles
    // row is nice-to-have; if it cannot be read or written (e.g. the live
    // schema is behind the migrations), keep the user signed in.
    try {
      const repo = await getRepo();
      let profile: Profile | null = await repo.getProfile(data.user.id);
      if (!profile) {
        profile = await repo.upsertProfile(fallback);
      }
      return {
        id: profile.id,
        email: profile.email ?? fallback.email,
        displayName: profile.displayName ?? fallback.displayName,
      };
    } catch (profileError) {
      console.error(
        "[auth] profiles read/write failed; using auth user. Run supabase/migrations/0003_reconcile_live_schema.sql.",
        profileError instanceof Error ? profileError.message : profileError,
      );
      return fallback;
    }
  }

  const userId = await readLocalUserId();
  if (!userId) {
    return null;
  }
  const local = getLocalUser(userId);
  if (!local) {
    return null;
  }
  const repo = await getRepo();
  await repo.upsertProfile({
    id: local.id,
    email: local.email,
    displayName: local.displayName,
  });
  return {
    id: local.id,
    email: local.email,
    displayName: local.displayName,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthRequiredError();
  }
  return user;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthRequiredError";
  }
}
