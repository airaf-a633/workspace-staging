import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { serverEnv } from "@/env";

/**
 * "Continue with Outlook" sign-in (decided 2026-10-20): OAuth 2.0 authorization code with PKCE against Microsoft's
 * common endpoint, so work, school and personal accounts all work. Asks for offline access (a refresh token, kept
 * in Vault), reading and sending mail, including shared mailboxes the person can open.
 */

export const SCOPES = [
  "offline_access",
  "openid",
  "email",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.ReadWrite.Shared",
  "Mail.Send",
  "Mail.Send.Shared",
].join(" ");

const AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0";
export const OAUTH_COOKIE = "relay_oauth_ms";

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function microsoftConfigured() {
  const env = serverEnv();
  return !!env.MICROSOFT_CLIENT_ID && !!env.MICROSOFT_CLIENT_SECRET;
}

/** A fresh state and PKCE pair; the verifier and state go in a short-lived httpOnly cookie. */
export function newAttempt() {
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { state, verifier, challenge };
}

export function authorizeUrl(redirectUri: string, state: string, challenge: string) {
  const u = new URL(`${AUTH}/authorize`);
  u.search = new URLSearchParams({
    client_id: serverEnv().MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return u.toString();
}

export interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
}

export async function exchangeCode(code: string, redirectUri: string, verifier: string): Promise<MicrosoftTokens> {
  const env = serverEnv();
  const res = await fetch(`${AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID!,
      client_secret: env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      scope: SCOPES,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<MicrosoftTokens> & { error?: string };
  if (!res.ok || !json.access_token || !json.refresh_token) throw new Error(json.error ?? `token ${res.status}`);
  return { access_token: json.access_token, refresh_token: json.refresh_token };
}

/** The signed-in person's address. */
export async function whoAmI(accessToken: string): Promise<string> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = (await res.json().catch(() => ({}))) as { mail?: string | null; userPrincipalName?: string };
  if (!res.ok) throw new Error(`me ${res.status}`);
  return (json.mail || json.userPrincipalName || "").toLowerCase();
}
