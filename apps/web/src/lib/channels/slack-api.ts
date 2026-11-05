import { fresh, signedBy } from "./signatures";

/**
 * Slack helpers for the web app (decided 2026-11-02), written from Slack's own pages read on 2 November 2026.
 * Pure functions only: the routes hold the secrets and the network.
 */

/** What the Relay app asks for. Each is something Slack's pages say a method needs: reading messages in public and
    private channels, posting replies, looking up who wrote (users.info), and downloading files. */
export const SLACK_SCOPES = ["channels:history", "groups:history", "chat:write", "users:read", "files:read"] as const;

/**
 * Slack signs every request: HMAC SHA-256, keyed with the app's signing secret, over "v0:<timestamp>:<raw body>",
 * as hex with a "v0=" prefix, in X-Slack-Signature. A timestamp more than five minutes off is refused (replay).
 */
export function validSlackSignature(secret: string, timestamp: string | null, raw: string, signature: string | null, nowMs: number): boolean {
  if (!timestamp || !/^\d+$/.test(timestamp) || !fresh(Number(timestamp), nowMs, 300)) return false;
  const expected = signature && signature.startsWith("v0=") ? signature.slice(3) : null;
  return signedBy("sha256", secret, `v0:${timestamp}:${raw}`, expected, "hex");
}

/** The address a person is sent to in order to add Relay to their Slack workspace. */
export function slackAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const u = new URL("https://slack.com/oauth/v2/authorize");
  u.search = new URLSearchParams({ client_id: clientId, scope: SLACK_SCOPES.join(","), redirect_uri: redirectUri, state }).toString();
  return u.toString();
}

export interface SlackInstall {
  token: string;
  botUserId: string;
  teamId: string;
  teamName: string;
}

export type SlackResult<T> = { ok: true; value: T } | { ok: false; reason: "unreachable" | "rejected"; error?: string };

/** Swaps the one-time code for the workspace's bot token. The code is good for ten minutes and one use. */
export async function exchangeSlackCode(f: typeof fetch, clientId: string, clientSecret: string, code: string, redirectUri: string): Promise<SlackResult<SlackInstall>> {
  let res: Response;
  try {
    res = await f("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; access_token?: unknown; bot_user_id?: unknown; team?: { id?: unknown; name?: unknown } };
  const token = body.access_token;
  const teamId = body.team?.id;
  const botUserId = body.bot_user_id;
  if (!body.ok || typeof token !== "string" || typeof teamId !== "string" || typeof botUserId !== "string") {
    return { ok: false, reason: "rejected", ...(typeof body.error === "string" ? { error: body.error } : {}) };
  }
  return { ok: true, value: { token, botUserId, teamId, teamName: typeof body.team?.name === "string" && body.team.name ? body.team.name : teamId } };
}

/** What to do with a body Slack posted to the events address. */
export type SlackAction =
  | { kind: "challenge"; challenge: string }
  | { kind: "message"; team: string }
  | { kind: "removed"; team: string }
  | { kind: "ignore" };

export function slackAction(body: unknown): SlackAction {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (b.type === "url_verification" && typeof b.challenge === "string") return { kind: "challenge", challenge: b.challenge };
  if (b.type !== "event_callback" || typeof b.team_id !== "string" || !b.team_id) return { kind: "ignore" };
  const inner = b.event && typeof b.event === "object" ? (b.event as Record<string, unknown>).type : undefined;
  if (inner === "message") return { kind: "message", team: b.team_id };
  if (inner === "app_uninstalled") return { kind: "removed", team: b.team_id };
  return { kind: "ignore" };
}
