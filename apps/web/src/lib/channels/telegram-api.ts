/**
 * The few Telegram Bot API calls the web app makes when someone connects, checks or disconnects a bot
 * (decided 2026-11-01). Written from Telegram's Bot API reference: setWebhook takes `url`, `secret_token`,
 * `allowed_updates` and `drop_pending_updates` (an empty `url` removes the webhook); getWebhookInfo returns
 * `url`, `pending_update_count`, `last_error_date` and `last_error_message`. The bot token is part of every
 * address, so it is never logged and never put in an error message.
 */

const API = "https://api.telegram.org";

export type Fetch = typeof fetch;
export type TelegramResult<T> = { ok: true; value: T } | { ok: false; reason: "unreachable" | "rejected"; description?: string };

interface Answer {
  ok?: boolean;
  description?: string;
  result?: unknown;
}

async function call(f: Fetch, token: string, method: string, payload: Record<string, unknown> = {}): Promise<{ status: number; body: Answer } | null> {
  try {
    const res = await f(`${API}/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Answer };
  } catch {
    return null;
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export interface BotIdentity {
  id: number;
  username: string | null;
  name: string;
}

/** Checks a token and says whose bot it is. Telegram refuses an invalid token, which we report as "rejected". */
export async function getMe(f: Fetch, token: string): Promise<TelegramResult<BotIdentity>> {
  const r = await call(f, token, "getMe");
  if (!r) return { ok: false, reason: "unreachable" };
  const me = obj(r.body.result);
  if (r.status !== 200 || !r.body.ok || typeof me.id !== "number" || me.is_bot === false) return { ok: false, reason: "rejected", ...(r.body.description ? { description: r.body.description } : {}) };
  const username = typeof me.username === "string" ? me.username : null;
  return { ok: true, value: { id: me.id, username, name: typeof me.first_name === "string" ? me.first_name : (username ?? "Telegram bot") } };
}

/** Points the bot at Relay. Only private-chat messages are used, so only `message` updates are requested. */
export async function setWebhook(f: Fetch, token: string, url: string, secretToken: string): Promise<TelegramResult<true>> {
  const r = await call(f, token, "setWebhook", { url, secret_token: secretToken, allowed_updates: ["message"], drop_pending_updates: false });
  if (!r) return { ok: false, reason: "unreachable" };
  return r.status === 200 && r.body.ok ? { ok: true, value: true } : { ok: false, reason: "rejected", ...(r.body.description ? { description: r.body.description } : {}) };
}

/** An empty address removes the webhook integration (Telegram's own wording). */
export async function removeWebhook(f: Fetch, token: string): Promise<TelegramResult<true>> {
  const r = await call(f, token, "setWebhook", { url: "" });
  if (!r) return { ok: false, reason: "unreachable" };
  return r.status === 200 && r.body.ok ? { ok: true, value: true } : { ok: false, reason: "rejected", ...(r.body.description ? { description: r.body.description } : {}) };
}

export interface WebhookHealth {
  url: string;
  pending: number;
  lastError: string | null;
  lastErrorAt: Date | null;
}

export async function getWebhookInfo(f: Fetch, token: string): Promise<TelegramResult<WebhookHealth>> {
  const r = await call(f, token, "getWebhookInfo");
  if (!r) return { ok: false, reason: "unreachable" };
  if (r.status !== 200 || !r.body.ok) return { ok: false, reason: "rejected", ...(r.body.description ? { description: r.body.description } : {}) };
  const w = obj(r.body.result);
  return {
    ok: true,
    value: {
      url: typeof w.url === "string" ? w.url : "",
      pending: typeof w.pending_update_count === "number" ? w.pending_update_count : 0,
      lastError: typeof w.last_error_message === "string" ? w.last_error_message : null,
      lastErrorAt: typeof w.last_error_date === "number" ? new Date(w.last_error_date * 1000) : null,
    },
  };
}

/** A random value for Telegram's secret_token header (1 to 256 characters of A-Z a-z 0-9 _ -). */
export function newSecretToken(random: (n: number) => Buffer): string {
  return random(24).toString("base64url");
}
