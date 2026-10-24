"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabasePublicEnv } from "@/lib/supabase/env";

export function createSupabaseBrowserClient() {
  const env = supabasePublicEnv();
  if (!env) {
    return null;
  }
  return createBrowserClient(env.url, env.anonKey);
}
