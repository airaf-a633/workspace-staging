import { signedBy } from "./signatures";

/**
 * Twilio helpers for the web app (decided 2026-11-01), written from Twilio's own pages: a webhook is signed with
 * X-Twilio-Signature, the base64 HMAC-SHA1, keyed with the account Auth Token, of the full URL (through the end of
 * the query string) followed by every POST parameter sorted alphabetically as name then value, with no separators.
 * The URL must be exactly what Twilio was told, so callers build it from Relay's configured public address, never
 * from the proxied request.
 */

/** The text Twilio signs: the address, then each form field sorted by name (case-sensitive), name then value. */
export function twilioSigningString(url: string, params: Record<string, string>): string {
  return url + Object.keys(params).sort().map((k) => k + params[k]).join("");
}

export function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string | null): boolean {
  return signedBy("sha1", authToken, twilioSigningString(url, params), signature, "base64");
}

/** A form body as an object. Twilio sends each field once, so the last value of a repeat is kept. */
export function formFields(raw: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(raw));
}

export type Fetch = typeof fetch;
export type TwilioResult<T> = { ok: true; value: T } | { ok: false; reason: "unreachable" | "rejected"; description?: string };

/** Checks the Account SID and Auth Token by fetching the account itself (HTTP Basic, as Twilio's API uses everywhere). */
export async function getAccount(f: Fetch, sid: string, token: string): Promise<TwilioResult<{ sid: string; name: string }>> {
  let res: Response;
  try {
    res = await f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
      headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  const body = (await res.json().catch(() => ({}))) as { sid?: unknown; friendly_name?: unknown; message?: unknown };
  if (!res.ok || body.sid !== sid) return { ok: false, reason: "rejected", ...(typeof body.message === "string" ? { description: body.message } : {}) };
  return { ok: true, value: { sid, name: typeof body.friendly_name === "string" && body.friendly_name ? body.friendly_name : sid } };
}

/** A phone number as +digits, or null when it can't be one (E.164 allows at most 15 digits). */
export function e164(input: string): string | null {
  const d = input.replace(/[^\d]/g, "");
  return d.length >= 7 && d.length <= 15 ? `+${d}` : null;
}
