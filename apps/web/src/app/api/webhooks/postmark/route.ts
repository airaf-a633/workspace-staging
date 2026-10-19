import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Postmark inbound email (decided 2026-10-19). Like the WhatsApp webhook, this route only checks, stores and
// queues; the worker files the email into a conversation. Postmark retries on non-2xx, and a repeated email is
// harmless because its Message-ID is the dedupe key.
export const dynamic = "force-dynamic";

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Postmark sends the credentials from the webhook URL (https://user:pass@…) as HTTP Basic auth. */
function authorised(request: Request, user: string, password: string) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const [u, ...rest] = Buffer.from(header.slice(6), "base64").toString("utf8").split(":");
  return same(u ?? "", user) && same(rest.join(":"), password);
}

export async function POST(request: Request) {
  const env = serverEnv();
  if (!env.POSTMARK_INBOUND_USER || !env.POSTMARK_INBOUND_PASSWORD) return new Response("Inbound email not configured", { status: 503 });

  const raw = await request.text();
  if (raw.length > 36_000_000) return new Response("Payload too large", { status: 413 }); // Postmark caps inbound at 35 MB
  const valid = authorised(request, env.POSTMARK_INBOUND_USER, env.POSTMARK_INBOUND_PASSWORD);
  if (!valid) return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="relay"' } });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const { error } = await createAdminClient().rpc("record_webhook", { p_provider: "postmark", p_payload: payload, p_signature_valid: true });
  if (error) {
    console.error("record_webhook failed", error.message);
    return new Response("Try again", { status: 500 });
  }
  return new Response("OK", { status: 200 });
}
