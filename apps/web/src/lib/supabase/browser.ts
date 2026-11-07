import { createBrowserClient } from "@supabase/ssr";

/** Supabase in the browser, signed in as the user (session cookies). Used for live updates only. */
let client: ReturnType<typeof createBrowserClient> | null = null;
export function browserClient() {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}
