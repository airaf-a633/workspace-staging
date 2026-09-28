import { z } from "zod";

const schema = z.object({
  supabaseUrl: z.url(),
  supabaseAnonKey: z.string().min(1),
  siteUrl: z.url().default("http://127.0.0.1:3000"),
});

/** Values that are safe in the browser. Validated so a missing .env fails loudly. */
export function publicEnv() {
  const parsed = schema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!parsed.success) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example).");
  }
  return parsed.data;
}
