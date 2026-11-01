import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The front door for every credential-based channel's webhook (decided 2026-11-01). Like the WhatsApp and Postmark
 * routes it only checks, stores and queues: the worker files the message. A provider's retry is harmless because
 * each message's own id is the dedupe key.
 *
 * The address is /api/webhooks/<provider>/<key>. The random key finds the channel, then the provider's own
 * signature proves the call is genuine. An unknown key looks the same as a missing page.
 */
export const WEBHOOK_KEY = /^[0-9a-f]{32}$/;
const MAX_BODY = 2_000_000;

export interface WebhookChannel {
  id: string;
  workspace_id: string;
  status: string;
  settings: Record<string, unknown>;
  secrets: Record<string, string>;
}

export interface Incoming {
  raw: string;
  headers: Headers;
  channel: WebhookChannel;
}

export interface IntakeOptions {
  /** True when the provider's signature (or secret header) checks out. */
  verify: (incoming: Incoming) => boolean | Promise<boolean>;
  /** Turns the raw body into JSON. Defaults to JSON.parse; forms (Twilio) supply their own. */
  parse?: (raw: string) => unknown;
  /** A message that says what is wrong with the body, or null when it is fine. Answers 422 with that message. */
  validate?: (body: unknown) => string | null;
  /** What to answer once the message is queued. Defaults to a plain 200 OK. */
  accepted?: () => Response;
  /** A handshake the provider expects answered on the spot (Slack's url_verification); skips queueing. */
  handshake?: (body: unknown, incoming: Incoming) => Response | null;
}

export async function handleChannelWebhook(request: Request, type: string, key: string, options: IntakeOptions): Promise<Response> {
  if (!WEBHOOK_KEY.test(key)) return new Response("Not found", { status: 404 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response("Payload too large", { status: 413 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("channel_for_webhook", { p_type: type, p_key: key });
  if (error) {
    console.error(`channel_for_webhook(${type}) failed`, error.message);
    return new Response("Try again", { status: 500 });
  }
  const channel = (data as WebhookChannel[] | null)?.[0];
  if (!channel) return new Response("Not found", { status: 404 });

  const incoming: Incoming = { raw, headers: request.headers, channel };
  if (!(await options.verify(incoming))) {
    console.warn(`SECURITY: ${type} webhook with a bad signature for channel ${channel.id}`);
    return new Response("Unauthorized", { status: 401 });
  }

  // A disconnected channel answers like a live one (so the provider stops retrying) but files nothing.
  if (channel.status === "disconnected") return options.accepted?.() ?? new Response("OK", { status: 200 });

  let body: unknown;
  try {
    body = (options.parse ?? JSON.parse)(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const problem = options.validate?.(body);
  if (problem) return Response.json({ error: problem }, { status: 422 });
  const answer = options.handshake?.(body, incoming);
  if (answer) return answer;

  const { error: recordError } = await admin.rpc("record_webhook", {
    p_provider: "channel",
    p_payload: { channel_id: channel.id, type, body },
    p_signature_valid: true,
  });
  if (recordError) {
    console.error("record_webhook failed", recordError.message);
    return new Response("Try again", { status: 500 });
  }
  return options.accepted?.() ?? new Response("OK", { status: 200 });
}
