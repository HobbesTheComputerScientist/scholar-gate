import { memoryRepo } from "@/lib/db/memory-repo";
import { isSupabaseConfigured, type DbRepo } from "@/lib/db/repo";
import { createSupabaseRepo } from "@/lib/db/supabase-repo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getRepo(): Promise<DbRepo> {
  if (!isSupabaseConfigured()) {
    return memoryRepo;
  }
  const client = await createSupabaseServerClient();
  if (!client) {
    return memoryRepo;
  }
  return createSupabaseRepo(client);
}
