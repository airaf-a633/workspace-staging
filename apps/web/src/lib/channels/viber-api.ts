import { hmac, same } from "./signatures";

/**
 * Viber helpers for the web app (decided 2026-11-02), from Viber's REST bot API page read on 2 November 2026: every call
 * carries the bot's token in X-Viber-Auth-Token, callbacks carry X-Viber-Content-Signature (HMAC SHA-256 of the body,
 * keyed with the token), and Viber checks a new webhook address by calling it and expecting HTTP 200.
 */

const API = "https://chatapi.viber.com/pa";
/** message, subscribed and unsubscribed are mandatory; the rest give delivery ticks and the welcome message. */
export const EVENT_TYPES = ["message", "subscribed", "unsubscribed", "delivered", "seen", "failed", "conversation_started"] as const;

/**
 * True when the signature is the HMAC SHA-256 of the exact body under the token. Viber's page does not say whether the
 * digest is hex or base64, so both are accepted; either needs the token, so neither is weaker.
 */
export function validViberSignature(token: string, raw: string, signature: string | null): boolean {
  if (!token || !signature) return false;
  return same(hmac("sha256", token, raw, "hex"), signature.toLowerCase()) || same(hmac("sha256", token, raw, "base64"), signature);
}

/** A message_token is a 64-bit number, which JavaScript cannot hold exactly, so it is made a string before parsing. */
export function parseViberBody(raw: string): unknown {
  return JSON.parse(raw.replace(/("message_token"\s*:\s*)(\d+)/g, '$1"$2"'));
}

export type ViberResult<T> = { ok: true; value: T } | { ok: false; reason: "rejected" | "unreachable"; message?: string };

async function post(f: typeof fetch, token: string, method: string, body: unknown): Promise<{ status?: number; message?: string; data: Record<string, unknown> } | null> {
  try {
    const res = await f(`${API}/${method}`, {
      method: "POST",
      headers: { "x-viber-auth-token": token, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: typeof data.status === "number" ? data.status : undefined, message: typeof data.status_message === "string" ? data.status_message : undefined, data };
  } catch {
    return null;
  }
}

/** Checks the token by asking for the account itself. Status 2 is Viber's "invalidAuthToken". */
export async function getAccountInfo(f: typeof fetch, token: string): Promise<ViberResult<{ id: string; name: string; webhook: string | undefined }>> {
  const r = await post(f, token, "get_account_info", {});
  if (!r) return { ok: false, reason: "unreachable" };
  if (r.status !== 0) return r.status === undefined ? { ok: false, reason: "unreachable" } : { ok: false, reason: "rejected", ...(r.message ? { message: r.message } : {}) };
  const id = r.data.id;
  if (typeof id !== "string" && typeof id !== "number") return { ok: false, reason: "rejected" };
  return { ok: true, value: { id: String(id), name: typeof r.data.name === "string" ? r.data.name : "", webhook: typeof r.data.webhook === "string" && r.data.webhook ? r.data.webhook : undefined } };
}

/** Points the bot at Relay. Viber calls the address once and wants HTTP 200, so the route must already be live. */
export async function setWebhook(f: typeof fetch, token: string, url: string): Promise<ViberResult<true>> {
  const r = await post(f, token, "set_webhook", { url, event_types: EVENT_TYPES, send_name: true, send_photo: true });
  if (!r) return { ok: false, reason: "unreachable" };
  if (r.status === 0) return { ok: true, value: true };
  return { ok: false, reason: "rejected", ...(r.message ? { message: r.message } : {}) };
}

/** Viber: "To remove the webhook, send set_webhook with an empty url." */
export async function removeWebhook(f: typeof fetch, token: string): Promise<ViberResult<true>> {
  const r = await post(f, token, "set_webhook", { url: "" });
  if (!r) return { ok: false, reason: "unreachable" };
  return r.status === 0 ? { ok: true, value: true } : { ok: false, reason: "rejected", ...(r.message ? { message: r.message } : {}) };
}
