import { verifySignature, verifySubscription } from "@app/whatsapp";
import { serverEnv } from "@/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Meta retries for up to 7 days and may send duplicates or out of order: this route only
// verifies, stores and queues. All processing happens in the worker.
export const dynamic = "force-dynamic";

/** Subscription handshake when the webhook URL is saved in the Meta app dashboard. */
export async function GET(request: Request) {
  const challenge = verifySubscription(new URL(request.url).searchParams, serverEnv().META_WEBHOOK_VERIFY_TOKEN ?? "");
  return challenge === null ? new Response("Forbidden", { status: 403 }) : new Response(challenge, { status: 200 });
}

export async function POST(request: Request) {
  const env = serverEnv();
  if (!env.META_APP_SECRET) return new Response("Webhook not configured", { status: 503 });

  const raw = await request.text();
  if (raw.length > 3_500_000) return new Response("Payload too large", { status: 413 }); // Meta caps payloads at 3 MB

  const valid = verifySignature(raw, request.headers.get("x-hub-signature-256"), env.META_APP_SECRET);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Invalid signatures are stored for audit but never queued, and get 401 so a real
  // misconfiguration shows up in Meta's dashboard instead of being silently accepted.
  const { error } = await createAdminClient().rpc("record_webhook", { p_provider: "whatsapp", p_payload: payload, p_signature_valid: valid });
  if (error) {
    console.error("record_webhook failed", error.message);
    return new Response("Try again", { status: 500 }); // Meta will retry
  }
  return valid ? new Response("OK", { status: 200 }) : new Response("Invalid signature", { status: 401 });
}
