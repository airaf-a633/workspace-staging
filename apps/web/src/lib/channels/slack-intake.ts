import "server-only";
import { serverEnv } from "@/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { slackAction, validSlackSignature } from "./slack-api";

/**
 * The one address Slack calls for every workspace that added Relay (decided 2026-11-02): /api/webhooks/slack.
 * Slack signs each request with the Relay app's signing secret, so the address needs no key. The workspace is found
 * from the team id on the event. Like the other channels it only checks, stores and queues; the worker files the
 * message. Slack wants a 2xx within three seconds, so nothing slow happens here.
 */
const MAX_BODY = 2_000_000;
const ok = () => new Response("OK", { status: 200 });

export async function handleSlackEvent(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response("Payload too large", { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const action = slackAction(body);
  // Slack's handshake only needs its own challenge handed back: no secret, no state, nothing to forge.
  if (action.kind === "challenge") return new Response(action.challenge, { status: 200, headers: { "content-type": "text/plain" } });

  const secret = serverEnv().SLACK_SIGNING_SECRET;
  if (!secret) return new Response("Not found", { status: 404 });
  if (!validSlackSignature(secret, request.headers.get("x-slack-request-timestamp"), raw, request.headers.get("x-slack-signature"), Date.now())) {
    console.warn("SECURITY: Slack event with a bad signature");
    return new Response("Unauthorized", { status: 401 });
  }
  if (action.kind === "ignore") return ok();

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("slack_channel_for_team", { p_team: action.team });
  if (error) {
    console.error("slack_channel_for_team failed", error.message);
    return new Response("Try again", { status: 500 });
  }
  const channel = (data as { id: string; status: string }[] | null)?.[0];
  // A workspace Relay doesn't know, or one that was disconnected: answered like a live one so Slack stops retrying.
  if (!channel) return ok();

  if (action.kind === "removed") {
    const { error: removeError } = await admin.rpc("slack_app_removed", { p_team: action.team });
    if (removeError) {
      console.error("slack_app_removed failed", removeError.message);
      return new Response("Try again", { status: 500 });
    }
    return ok();
  }
  if (channel.status === "disconnected") return ok();

  const { error: recordError } = await admin.rpc("record_webhook", {
    p_provider: "channel",
    p_payload: { channel_id: channel.id, type: "slack", body },
    p_signature_valid: true,
  });
  if (recordError) {
    console.error("record_webhook failed", recordError.message);
    return new Response("Try again", { status: 500 });
  }
  return ok();
}
