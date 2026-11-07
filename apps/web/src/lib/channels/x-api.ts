import { hmac, same } from "./signatures";

/**
 * X (Twitter) helpers for the web app (decided 2026-11-02), from docs.x.com pages read on 2 November 2026. The business uses
 * its own X developer app: it logs in with OAuth 2.0 (authorization code with PKCE), Relay registers a webhook with the
 * app's bearer token and subscribes the account to the dm.received event.
 *
 *  - Authorize: https://x.com/i/oauth2/authorize; the code lives 30 seconds. Token: POST https://api.x.com/2/oauth2/token, a
 *    confidential client sends its client id and secret as a Basic header. A refresh token comes only with offline.access.
 *  - Webhook: POST /2/webhooks { url } with the app-only bearer token. X then calls the address with a CRC check
 *    (GET ?crc_token=...) and expects {response_token: "sha256=" + base64 HMAC-SHA256(crc_token) keyed with the client secret};
 *    it repeats hourly, and a failed check stops delivery. Events carry X-Twitter-Webhooks-Signature-OAuth2:
 *    "sha256=" + base64 HMAC-SHA256 of the raw body, same key.
 *  - Subscribe: POST /2/activity/subscriptions { event_type: "dm.received", filter: { user_id }, webhook_id }; dm.* needs dm.read.
 */

const API = "https://api.x.com";
/** dm.read and dm.write are the DM scopes; tweet.read and users.read go with them; offline.access gives a refresh token. */
export const X_SCOPES = ["dm.read", "dm.write", "tweet.read", "users.read", "offline.access"] as const;

export function xAuthorizeUrl(clientId: string, redirectUri: string, state: string, challenge: string): string {
  const u = new URL("https://x.com/i/oauth2/authorize");
  u.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: X_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return u.toString();
}

/** The answer to X's CRC check. */
export function crcResponse(clientSecret: string, crcToken: string): { response_token: string } {
  return { response_token: `sha256=${hmac("sha256", clientSecret, crcToken, "base64")}` };
}

/** True when the signature header is "sha256=" + the base64 HMAC-SHA256 of the exact body under the client secret. */
export function validXSignature(clientSecret: string, raw: string, signature: string | null): boolean {
  if (!clientSecret || !signature) return false;
  return same(`sha256=${hmac("sha256", clientSecret, raw, "base64")}`, signature);
}

const basic = (id: string, secret: string) => `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;

export type XResult<T> = { ok: true; value: T } | { ok: false; reason: "rejected" | "unreachable"; detail?: string };

async function call(f: typeof fetch, url: string, init: RequestInit): Promise<{ status: number; body: Record<string, unknown> } | null> {
  try {
    const res = await f(url, { ...init, signal: AbortSignal.timeout(15_000) });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return null;
  }
}

const detailOf = (body: Record<string, unknown>) => [body.title, body.detail, body.error_description].filter((v): v is string => typeof v === "string").join(": ").slice(0, 250) || undefined;
const fail = (r: { status: number; body: Record<string, unknown> } | null): XResult<never> => (!r || r.status >= 500 ? { ok: false, reason: "unreachable" } : { ok: false, reason: "rejected", ...(detailOf(r.body) ? { detail: detailOf(r.body)! } : {}) });

export interface XTokens {
  accessToken: string;
  refreshToken: string | undefined;
  expiresAt: number;
}

/** Swaps the one-time code (good for 30 seconds) for the account's tokens. */
export async function exchangeXCode(f: typeof fetch, clientId: string, clientSecret: string, code: string, redirectUri: string, verifier: string, now = Date.now()): Promise<XResult<XTokens>> {
  const r = await call(f, `${API}/2/oauth2/token`, {
    method: "POST",
    headers: { authorization: basic(clientId, clientSecret), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, grant_type: "authorization_code", client_id: clientId, redirect_uri: redirectUri, code_verifier: verifier }),
  });
  const token = r?.body.access_token;
  if (!r || r.status !== 200 || typeof token !== "string") return fail(r);
  return {
    ok: true,
    value: {
      accessToken: token,
      refreshToken: typeof r.body.refresh_token === "string" ? r.body.refresh_token : undefined,
      expiresAt: now + (typeof r.body.expires_in === "number" ? r.body.expires_in : 7200) * 1000,
    },
  };
}

/** Who the login belongs to (GET /2/users/me needs a user token). */
export async function getMe(f: typeof fetch, accessToken: string): Promise<XResult<{ id: string; username: string | undefined }>> {
  const r = await call(f, `${API}/2/users/me`, { headers: { authorization: `Bearer ${accessToken}` } });
  const data = (r?.body.data ?? {}) as { id?: unknown; username?: unknown };
  if (!r || r.status !== 200 || typeof data.id !== "string") return fail(r);
  return { ok: true, value: { id: data.id, username: typeof data.username === "string" ? data.username : undefined } };
}

/** Registers the address X will send events to. X checks it at once with the CRC call, so the route must be live. */
export async function registerWebhook(f: typeof fetch, bearerToken: string, url: string): Promise<XResult<{ id: string }>> {
  const r = await call(f, `${API}/2/webhooks`, { method: "POST", headers: { authorization: `Bearer ${bearerToken}`, "content-type": "application/json" }, body: JSON.stringify({ url }) });
  const data = (r?.body.data ?? {}) as { id?: unknown; valid?: unknown };
  if (!r || r.status >= 300 || typeof data.id !== "string") return fail(r);
  // X: a webhook that failed its CRC check is marked invalid and receives nothing.
  if (data.valid === false) return { ok: false, reason: "rejected", detail: "X could not complete its check of Relay's address." };
  return { ok: true, value: { id: data.id } };
}

/** Subscribes the account to direct messages it receives. Making the same subscription again only refreshes it. */
export async function subscribeToDms(f: typeof fetch, accessToken: string, userId: string, webhookId: string): Promise<XResult<true>> {
  const r = await call(f, `${API}/2/activity/subscriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ event_type: "dm.received", filter: { user_id: userId }, webhook_id: webhookId }),
  });
  if (!r || r.status >= 300) return fail(r);
  return { ok: true, value: true };
}
