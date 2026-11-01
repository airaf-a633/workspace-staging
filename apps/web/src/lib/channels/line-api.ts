/**
 * The one LINE call the web app makes (decided 2026-11-01): checking the pasted access token with
 * `GET https://api.line.me/v2/bot/info`, which LINE documents as returning the account's user id and display name.
 * That user id is also the `destination` LINE puts on every webhook, so it identifies the account. The token is
 * sent in a header and is never logged or put in an error message.
 */

export type Fetch = typeof fetch;
export type LineResult<T> = { ok: true; value: T } | { ok: false; reason: "unreachable" | "rejected" | "unknown_account"; description?: string };

export interface BotIdentity {
  userId: string;
  name: string;
}

export async function getBotInfo(f: Fetch, token: string): Promise<LineResult<BotIdentity>> {
  let res: Response;
  try {
    res = await f("https://api.line.me/v2/bot/info", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  const body = (await res.json().catch(() => ({}))) as { userId?: unknown; displayName?: unknown; message?: unknown };
  if (!res.ok) return { ok: false, reason: "rejected", ...(typeof body.message === "string" ? { description: body.message } : {}) };
  // Without the account's user id we can't tell which account this is, so we don't guess.
  if (typeof body.userId !== "string" || !body.userId) return { ok: false, reason: "unknown_account" };
  return { ok: true, value: { userId: body.userId, name: typeof body.displayName === "string" && body.displayName ? body.displayName : "LINE" } };
}
