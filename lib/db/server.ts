import { memoryRepo } from "@/lib/db/memory-repo";
import { isSupabaseConfigured, type DbRepo } from "@/lib/db/repo";
import { createSupabaseRepo } from "@/lib/db/supabase-repo";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where project data lives:
 * - "supabase": live Postgres (schema matches the migrations)
 * - "server": Supabase is configured but its schema is behind the migrations,
 *   so data is kept in server memory while auth still uses Supabase.
 *   Run supabase/migrations/0003_reconcile_live_schema.sql to switch over.
 * - "local": no Supabase configured (memory repo + cookie auth)
 */
export type Persistence = "supabase" | "server" | "local";

/** Columns the app writes that older live schemas are missing. */
const REQUIRED_COLUMNS: Record<string, string> = {
  profiles: "id,email,display_name",
  projects: "id,user_id,name,state",
  papers: "id,stance,doi,publication_year,open_access_url,citation_count",
  decisions: "id,summary,rationale",
  messages: "id,role,content",
  summaries: "id,content,message_count_at",
  proposed_patches: "id,tool,payload,status",
  orient_checks: "id,topic,questions_json,student_answers_json,score,passed",
};

const RECHECK_AFTER_FAILURE_MS = 60_000;

type SchemaCheck = { ok: boolean; missing: string[]; checkedAt: number };

const globalForSchema = globalThis as typeof globalThis & {
  __researchCoachSchema?: Promise<SchemaCheck>;
  __researchCoachSchemaWarned?: boolean;
};

async function probeSchema(): Promise<SchemaCheck> {
  const env = supabasePublicEnv();
  if (!env) {
    return { ok: false, missing: ["config"], checkedAt: Date.now() };
  }
  const headers = { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}` };
  const results = await Promise.all(
    Object.entries(REQUIRED_COLUMNS).map(async ([table, columns]) => {
      try {
        const response = await fetch(
          `${env.url}/rest/v1/${table}?select=${columns}&limit=0`,
          { headers, cache: "no-store" },
        );
        return response.ok ? null : table;
      } catch {
        return table;
      }
    }),
  );
  const missing = results.filter((table): table is string => table !== null);
  return { ok: missing.length === 0, missing, checkedAt: Date.now() };
}

/** Cached check that the live schema has every column the app uses. */
async function liveSchemaCheck(): Promise<SchemaCheck> {
  const cached = globalForSchema.__researchCoachSchema;
  if (cached) {
    const result = await cached;
    if (result.ok || Date.now() - result.checkedAt < RECHECK_AFTER_FAILURE_MS) {
      return result;
    }
  }
  const next = probeSchema();
  globalForSchema.__researchCoachSchema = next;
  const result = await next;
  if (!result.ok && !globalForSchema.__researchCoachSchemaWarned) {
    globalForSchema.__researchCoachSchemaWarned = true;
    console.warn(
      `[db] Supabase schema is behind the app (tables: ${result.missing.join(", ")}). ` +
        "Keeping project data in server memory until supabase/migrations/0003_reconcile_live_schema.sql is run.",
    );
  }
  if (result.ok) {
    globalForSchema.__researchCoachSchemaWarned = false;
  }
  return result;
}

export async function getPersistence(): Promise<Persistence> {
  if (!isSupabaseConfigured()) {
    return "local";
  }
  return (await liveSchemaCheck()).ok ? "supabase" : "server";
}

export async function getRepo(): Promise<DbRepo> {
  if ((await getPersistence()) !== "supabase") {
    return memoryRepo;
  }
  const client = await createSupabaseServerClient();
  if (!client) {
    return memoryRepo;
  }
  return createSupabaseRepo(client);
}
