import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

/**
 * Microsoft Teams helpers for the web app (decided 2026-11-02), written from Microsoft's "Authenticate requests with
 * the Bot Connector API" page, read on 2 November 2026. Two jobs: prove that a request to the messaging endpoint
 * really came from the Bot Connector service, and check a pasted App ID, secret and tenant.
 */

const OPENID = "https://login.botframework.com/v1/.well-known/openidconfiguration";
const ISSUER = "https://api.botframework.com";
const SKEW_SECONDS = 300;
const KEYS_TTL_MS = 12 * 60 * 60 * 1000; // Microsoft: refresh at least every 24 hours

export interface SigningKey extends JsonWebKey {
  kid?: string;
  endorsements?: string[];
}

const b64 = (s: string) => Buffer.from(s, "base64url");
const json = (s: string): unknown => JSON.parse(b64(s).toString("utf8"));

export type JwtVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Microsoft's seven checks on a token from the Bot Connector: sent as a Bearer token, valid JWT, issuer
 * https://api.botframework.com, audience equal to the bot's App ID, inside its validity period (5 minutes of clock
 * skew), a valid RS256 signature from a key in Microsoft's list, and a serviceUrl claim equal to the activity's.
 * Microsoft also says to require the key's endorsement for the activity's channel id when the key carries any.
 */
export function verifyConnectorToken(opts: { authorization: string | null; appId: string; serviceUrl: string; channelId: string; keys: SigningKey[]; nowMs: number }): JwtVerdict {
  const bearer = /^Bearer (\S+)$/i.exec(opts.authorization ?? "");
  if (!bearer) return { ok: false, reason: "no bearer token" };
  const parts = bearer[1]!.split(".");
  if (parts.length !== 3) return { ok: false, reason: "not a JWT" };
  let header: { alg?: string; kid?: string };
  let claims: { iss?: string; aud?: string; exp?: number; nbf?: number; serviceUrl?: string };
  try {
    header = json(parts[0]!) as typeof header;
    claims = json(parts[1]!) as typeof claims;
  } catch {
    return { ok: false, reason: "not valid JSON" };
  }
  if (header.alg !== "RS256") return { ok: false, reason: "unexpected algorithm" };
  if (claims.iss !== ISSUER) return { ok: false, reason: "wrong issuer" };
  if (claims.aud !== opts.appId) return { ok: false, reason: "wrong audience" };
  const now = opts.nowMs / 1000;
  if (typeof claims.exp !== "number" || claims.exp + SKEW_SECONDS < now) return { ok: false, reason: "expired" };
  if (typeof claims.nbf === "number" && claims.nbf - SKEW_SECONDS > now) return { ok: false, reason: "not yet valid" };
  if (claims.serviceUrl !== opts.serviceUrl) return { ok: false, reason: "serviceUrl does not match" };

  const key = opts.keys.find((k) => k.kid && k.kid === header.kid);
  if (!key) return { ok: false, reason: "unknown signing key" };
  try {
    // Microsoft's keys are RSA: the modulus and exponent are all Node needs.
    const publicKey = createPublicKey({ key: { kty: "RSA", n: key.n, e: key.e }, format: "jwk" });
    if (!verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, b64(parts[2]!))) return { ok: false, reason: "bad signature" };
  } catch {
    return { ok: false, reason: "bad signature" };
  }
  if (Array.isArray(key.endorsements) && key.endorsements.length && !key.endorsements.includes(opts.channelId)) return { ok: false, reason: "channel not endorsed" };
  return { ok: true };
}

let cache: { keys: SigningKey[]; at: number } | undefined;
export const forgetKeys = () => { cache = undefined; };

/** Microsoft's signing keys, kept for twelve hours. Asks again at once for a key id it has not seen (new keys can appear any time). */
export async function connectorKeys(f: typeof fetch, nowMs = Date.now(), wantKid?: string): Promise<SigningKey[]> {
  const stale = !cache || nowMs - cache.at > KEYS_TTL_MS;
  const unseen = !!wantKid && !!cache && !cache.keys.some((k) => k.kid === wantKid) && nowMs - cache.at > 60_000;
  if (!stale && !unseen) return cache!.keys;
  try {
    const meta = (await (await f(OPENID, { signal: AbortSignal.timeout(10_000) })).json()) as { jwks_uri?: string };
    if (typeof meta.jwks_uri !== "string" || !meta.jwks_uri.startsWith("https://")) throw new Error("no jwks_uri");
    const body = (await (await f(meta.jwks_uri, { signal: AbortSignal.timeout(10_000) })).json()) as { keys?: SigningKey[] };
    if (!Array.isArray(body.keys)) throw new Error("no keys");
    cache = { keys: body.keys, at: nowMs };
  } catch (e) {
    if (!cache) throw e;
  }
  return cache!.keys;
}

/** The kid in a token's header, so the right key can be asked for. */
export function tokenKid(authorization: string | null): string | undefined {
  const token = /^Bearer (\S+)$/i.exec(authorization ?? "")?.[1];
  try {
    return token ? (json(token.split(".")[0]!) as { kid?: string }).kid : undefined;
  } catch {
    return undefined;
  }
}

export type TeamsResult<T> = { ok: true; value: T } | { ok: false; reason: "rejected" | "unreachable"; description?: string };

/** Asks Microsoft for a bot token: if it comes, the App ID, secret and tenant are right (Microsoft's documented client-credentials call). */
export async function checkBotCredentials(f: typeof fetch, appId: string, secret: string, tenantId: string): Promise<TeamsResult<true>> {
  let res: Response;
  try {
    res = await f(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: appId, client_secret: secret, scope: "https://api.botframework.com/.default" }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: unknown; error_description?: unknown };
  if (res.ok && typeof body.access_token === "string") return { ok: true, value: true };
  if (res.status >= 500) return { ok: false, reason: "unreachable" };
  return { ok: false, reason: "rejected", ...(typeof body.error_description === "string" ? { description: body.error_description.split("\r\n")[0]!.slice(0, 250) } : {}) };
}

export const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
