import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/env";

/**
 * Service-role client: bypasses row-level security. Use only in server code that has
 * already authenticated the caller some other way (e.g. a verified Meta webhook signature).
 * Never import this into anything that runs for a signed-in user's request by default.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
