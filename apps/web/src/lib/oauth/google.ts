import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { serverEnv } from "@/env";

/**
 * "Continue with Google" sign-in (decided 2026-10-20): OAuth 2.0 authorization code with PKCE. Asks for offline
 * access (a refresh token, kept in Vault), reading and labelling mail (gmail.modify) and sending (gmail.send).
 * Until Google verifies the app, only test users added in Google Cloud can connect, behind an "unverified" notice.
 */

export const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.send"].join(" ");
export const OAUTH_COOKIE = "relay_oauth_google";

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function googleConfigured() {
  const env = serverEnv();
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
}

export function newAttempt() {
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  return { state, verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

export function authorizeUrl(redirectUri: string, state: string, challenge: string) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: serverEnv().GOOGLE_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // A refresh token only comes with offline access, and Google only sends it again when consent is asked again.
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
  }).toString();
  return u.toString();
}

export async function exchangeCode(code: string, redirectUri: string, verifier: string) {
  const env = serverEnv();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; scope?: string; error?: string };
  if (!res.ok || !json.access_token || !json.refresh_token) throw new Error(json.error ?? `token ${res.status}`);
  // People can untick Gmail access on Google's consent screen; without it nothing works.
  const granted = (json.scope ?? "").split(" ");
  if (!granted.includes("https://www.googleapis.com/auth/gmail.modify") || !granted.includes("https://www.googleapis.com/auth/gmail.send")) {
    throw new Error("missing_scopes");
  }
  return { access_token: json.access_token, refresh_token: json.refresh_token };
}

export async function whoAmI(accessToken: string): Promise<string> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = (await res.json().catch(() => ({}))) as { email?: string; email_verified?: boolean };
  if (!res.ok || !json.email || json.email_verified === false) throw new Error("no_email");
  return json.email.toLowerCase();
}
