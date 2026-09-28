import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta signs every webhook with `X-Hub-Signature-256: sha256=<hex HMAC-SHA256 of the raw body, keyed by the app secret>`.
 * Verify against the exact raw bytes: re-serialising parsed JSON changes the signature.
 */
export function verifySignature(rawBody: string | Buffer, header: string | null | undefined, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!match) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(match[1]!, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** For tests and local tools: produce the header Meta would send. */
export function signBody(rawBody: string | Buffer, appSecret: string): string {
  return "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
}
