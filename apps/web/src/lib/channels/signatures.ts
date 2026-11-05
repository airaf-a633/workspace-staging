import { createHmac, timingSafeEqual } from "node:crypto";

/** Small, pure helpers for checking that a webhook really came from the provider. */

/** Compares two strings in constant time. */
export function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** HMAC of the exact request body: LINE sends it base64, Slack and others hex. */
export function hmac(algorithm: "sha256" | "sha1", secret: string, data: string, encoding: "base64" | "hex"): string {
  return createHmac(algorithm, secret).update(data).digest(encoding);
}

/** True when `signature` is the HMAC of `raw` under `secret`. An empty or missing signature is never valid. */
export function signedBy(algorithm: "sha256" | "sha1", secret: string, raw: string, signature: string | null, encoding: "base64" | "hex"): boolean {
  if (!secret || !signature) return false;
  return same(hmac(algorithm, secret, raw, encoding), signature);
}

/** A timestamp within `toleranceSeconds` of now, in seconds since 1970. Guards against replayed requests. */
export function fresh(timestampSeconds: number, nowMs: number, toleranceSeconds = 300): boolean {
  return Number.isFinite(timestampSeconds) && Math.abs(nowMs / 1000 - timestampSeconds) <= toleranceSeconds;
}
