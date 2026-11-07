import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { exchangeSlackCode, SLACK_SCOPES, slackAction, slackAuthorizeUrl, validSlackSignature } from "./slack-api";

const secret = "8f742231b10e8888abcd99yyyzzz85a5";
const now = 1_700_000_000_000;
const ts = String(now / 1000);
const sign = (body: string, t = ts, key = secret) => `v0=${createHmac("sha256", key).update(`v0:${t}:${body}`).digest("hex")}`;

describe("Slack's signature", () => {
  const body = '{"type":"event_callback","team_id":"T1"}';

  it("accepts a request signed over v0, the timestamp and the exact body", () => {
    expect(validSlackSignature(secret, ts, body, sign(body), now)).toBe(true);
  });

  it("refuses a changed body, another secret, and a missing or malformed signature", () => {
    expect(validSlackSignature(secret, ts, body + " ", sign(body), now)).toBe(false);
    expect(validSlackSignature(secret, ts, body, sign(body, ts, "other"), now)).toBe(false);
    expect(validSlackSignature(secret, ts, body, null, now)).toBe(false);
    expect(validSlackSignature(secret, ts, body, "v0=", now)).toBe(false);
    expect(validSlackSignature(secret, ts, body, sign(body).slice(3), now)).toBe(false);
    expect(validSlackSignature("", ts, body, sign(body, ts, ""), now)).toBe(false);
  });

  it("refuses a replay older than five minutes, and a bad timestamp", () => {
    const old = String(now / 1000 - 301);
    expect(validSlackSignature(secret, old, body, sign(body, old), now)).toBe(false);
    const edge = String(now / 1000 - 299);
    expect(validSlackSignature(secret, edge, body, sign(body, edge), now)).toBe(true);
    expect(validSlackSignature(secret, null, body, sign(body), now)).toBe(false);
    expect(validSlackSignature(secret, "abc", body, sign(body, "abc"), now)).toBe(false);
  });
});

describe("adding Relay to Slack", () => {
  it("builds the authorize address with the scopes, the way back and the state", () => {
    const u = new URL(slackAuthorizeUrl("123.456", "https://relay.example/api/oauth/slack/callback", "st4te"));
    expect(u.origin + u.pathname).toBe("https://slack.com/oauth/v2/authorize");
    expect(u.searchParams.get("client_id")).toBe("123.456");
    expect(u.searchParams.get("scope")).toBe(SLACK_SCOPES.join(","));
    expect(u.searchParams.get("redirect_uri")).toBe("https://relay.example/api/oauth/slack/callback");
    expect(u.searchParams.get("state")).toBe("st4te");
  });

  it("asks only for what Relay uses", () => {
    expect([...SLACK_SCOPES]).toEqual(["channels:history", "groups:history", "chat:write", "users:read", "files:read"]);
  });

  const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("reads the workspace and the bot token from Slack's answer", async () => {
    let sent: URLSearchParams | null = null;
    const f = (async (_u: string, init: RequestInit) => {
      sent = init.body as URLSearchParams;
      return new Response(JSON.stringify({ ok: true, access_token: "xoxb-1", bot_user_id: "U_BOT", app_id: "A1", team: { id: "T1", name: "Acme" }, authed_user: { id: "U1" } }));
    }) as unknown as typeof fetch;
    expect(await exchangeSlackCode(f, "cid", "csecret", "the-code", "https://relay.example/cb")).toEqual({ ok: true, value: { token: "xoxb-1", botUserId: "U_BOT", teamId: "T1", teamName: "Acme" } });
    expect(Object.fromEntries(sent!)).toEqual({ code: "the-code", client_id: "cid", client_secret: "csecret", redirect_uri: "https://relay.example/cb" });
  });

  it("names the workspace by its id when Slack gives no name", async () => {
    const r = await exchangeSlackCode(reply({ ok: true, access_token: "x", bot_user_id: "U", team: { id: "T9" } }), "a", "b", "c", "d");
    expect(r).toMatchObject({ ok: true, value: { teamName: "T9" } });
  });

  it("reports a refusal with Slack's code, an incomplete answer, and an outage", async () => {
    expect(await exchangeSlackCode(reply({ ok: false, error: "invalid_code" }), "a", "b", "c", "d")).toEqual({ ok: false, reason: "rejected", error: "invalid_code" });
    expect(await exchangeSlackCode(reply({ ok: true, access_token: "x" }), "a", "b", "c", "d")).toMatchObject({ ok: false, reason: "rejected" });
    expect(await exchangeSlackCode((async () => { throw new Error("offline"); }) as unknown as typeof fetch, "a", "b", "c", "d")).toEqual({ ok: false, reason: "unreachable" });
  });
});

describe("what to do with an events request", () => {
  it("answers Slack's handshake with its challenge", () => {
    expect(slackAction({ type: "url_verification", challenge: "abc", token: "x" })).toEqual({ kind: "challenge", challenge: "abc" });
  });

  it("queues messages, and notes the app being removed", () => {
    expect(slackAction({ type: "event_callback", team_id: "T1", event: { type: "message" } })).toEqual({ kind: "message", team: "T1" });
    expect(slackAction({ type: "event_callback", team_id: "T1", event: { type: "app_uninstalled" } })).toEqual({ kind: "removed", team: "T1" });
  });

  it("ignores everything else", () => {
    expect(slackAction({ type: "event_callback", team_id: "T1", event: { type: "reaction_added" } })).toEqual({ kind: "ignore" });
    expect(slackAction({ type: "event_callback", event: { type: "message" } })).toEqual({ kind: "ignore" });
    expect(slackAction({ type: "url_verification" })).toEqual({ kind: "ignore" });
    expect(slackAction(null)).toEqual({ kind: "ignore" });
  });
});
