import { createHash } from "node:crypto";

/**
 * Discord helpers for the web app (decided 2026-11-02), written from Discord's own pages read on 2 November 2026.
 * Messages are received by the separate Gateway process; the web app only checks a pasted token and builds the
 * link that adds the bot to a server.
 */

export type DiscordResult<T> = { ok: true; value: T } | { ok: false; reason: "rejected" | "unreachable" };

/** GET /gateway/bot "requires authentication using a valid bot token", so it doubles as the token check. */
export async function checkBotToken(f: typeof fetch, token: string, appUrl: string): Promise<DiscordResult<{ shards: number }>> {
  let res: Response;
  try {
    res = await f("https://discord.com/api/v10/gateway/bot", {
      headers: { authorization: `Bot ${token}`, "user-agent": `DiscordBot (${appUrl}, 1)` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (res.status === 401) return { ok: false, reason: "rejected" };
  const body = (await res.json().catch(() => ({}))) as { url?: unknown; shards?: unknown };
  if (!res.ok || typeof body.url !== "string") return { ok: false, reason: "unreachable" };
  return { ok: true, value: { shards: typeof body.shards === "number" ? body.shards : 1 } };
}

/**
 * Discord's permission bits, from its permissions page: View Channel (1 << 10), Send Messages (1 << 11) and Read
 * Message History (1 << 16, needed to reply under a message). Nothing else is asked for.
 */
export const BOT_PERMISSIONS = (1 << 10) + (1 << 11) + (1 << 16);

/** The link that adds the bot to a server. `scope=bot` and `permissions` are what Discord's OAuth2 page documents. */
export function inviteUrl(applicationId: string): string {
  const u = new URL("https://discord.com/oauth2/authorize");
  u.search = new URLSearchParams({ client_id: applicationId, scope: "bot", permissions: String(BOT_PERMISSIONS) }).toString();
  return u.toString();
}

/**
 * Relay doesn't know a bot's id until the Gateway says Ready, but each bot may be connected only once. A fingerprint
 * of the token (never the token) stands in as the channel's unique id until then.
 */
export function botFingerprint(token: string): string {
  return `tok-${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
}

/** What the channel page says about the Gateway connection, from the health the Gateway process recorded. */
export type DiscordHealth = "ok" | "rejected" | "unstable" | "intents" | "privileged_intents" | "waiting";

export function healthOf(health: unknown): DiscordHealth {
  const state = health && typeof health === "object" ? (health as { state?: unknown }).state : undefined;
  return state === "ok" || state === "rejected" || state === "unstable" || state === "intents" || state === "privileged_intents" ? state : "waiting";
}
