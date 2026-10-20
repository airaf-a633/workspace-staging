import { z } from "zod";

/** Treat `NAME=` (blank) in .env as not set, so optional values don't fail validation. */
function withoutBlanks(env: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ""));
}

const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WHATSAPP_API_VERSION: z.string().default("v25.0"),
  SENTRY_DSN: z.url().optional(),
  /** The domain forwarding addresses live on, e.g. in.relayinbox.com (email channel). */
  INBOUND_EMAIL_DOMAIN: z.string().optional(),
  /** Email channel, sending: Postmark's server token, and Relay's own verified sending domain (e.g. mail.relayinbox.com). */
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  EMAIL_SEND_DOMAIN: z.string().optional(),
  /** "Continue with Outlook": the Microsoft app, and the app's public address for Microsoft's push notifications. */
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  APP_URL: z.url().optional(),
  /** "Continue with Google": the Google Cloud OAuth client. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type WorkerEnv = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = schema.safeParse(withoutBlanks(source));
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }
  return parsed.data;
}
