import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The hosted partner preview (decided 2026-10-01): with SITE_MODE=preview the deployment serves only the
 * public website and /preview, behind one shared password (PREVIEW_PASSWORD). The real app, sign-in and
 * webhooks are switched off there, so nothing reaches the staging database.
 */
export const PREVIEW_COOKIE = "preview_access";

export function previewMode() {
  return process.env.SITE_MODE === "preview";
}

/** What the cookie holds: a hash of the password, so the password itself is never stored in the browser. */
export function accessToken(password: string) {
  return createHash("sha256").update(`workspace-preview:${password}`).digest("hex");
}

export function passwordMatches(given: string) {
  const expected = process.env.PREVIEW_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(accessToken(given));
  const b = Buffer.from(accessToken(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function tokenIsValid(token: string | undefined) {
  const expected = process.env.PREVIEW_PASSWORD;
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(accessToken(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only same-site paths, never "//evil.com". */
export function safeNextPath(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/preview";
}
