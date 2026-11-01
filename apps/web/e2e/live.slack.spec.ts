import { createHmac, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { clientAs, live, SLUG, unique } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* Slack's front door, without a real Slack workspace: we play Slack's part and sign each call the way Slack does
   (hex HMAC-SHA256 of "v0:<timestamp>:<body>" with the app's signing secret). This needs SLACK_SIGNING_SECRET in the
   environment the tests run in (the same value the server has). Filing a message needs Slack itself, because Relay
   asks Slack who wrote it, so that part is checked by hand with a real workspace (docs/FOUNDER_SETUP.md). */
test("Slack's handshake and signed events are accepted, forged ones are not", async ({ request }) => {
  const secret = process.env.SLACK_SIGNING_SECRET;
  test.skip(!secret, "Set SLACK_SIGNING_SECRET to the value the server uses");

  const owner = await clientAs("owner");
  const { data: ws } = await owner.from("workspaces").select("id").eq("slug", SLUG).single();
  const team = `T${randomBytes(5).toString("hex").toUpperCase()}`;
  const { error } = await owner.rpc("connect_channel", {
    p_workspace: ws!.id, p_type: "slack", p_name: unique("E2E Slack"), p_external_id: team,
    p_settings: { team_id: team, team_name: "E2E", bot_user_id: "U_BOT" }, p_secrets: { bot_token: "xoxb-not-real" },
  });
  expect(error).toBeNull();

  const send = (body: unknown, opts: { signed?: boolean; at?: number } = {}) => {
    const raw = JSON.stringify(body);
    const ts = String(Math.floor((opts.at ?? Date.now()) / 1000));
    const headers: Record<string, string> = { "content-type": "application/json", "x-slack-request-timestamp": ts };
    if (opts.signed !== false) headers["x-slack-signature"] = `v0=${createHmac("sha256", secret!).update(`v0:${ts}:${raw}`).digest("hex")}`;
    return request.post("/api/webhooks/slack", { data: raw, headers });
  };
  const message = (t: string) => ({ type: "event_callback", team_id: t, event_id: `Ev${randomBytes(6).toString("hex")}`, event: { type: "message", channel: "C1", channel_type: "channel", user: "U_ANA", text: "Hi", ts: "1700000000.000100" } });

  // The handshake hands the challenge back
  const hello = await request.post("/api/webhooks/slack", { data: { type: "url_verification", challenge: "abc123" } });
  expect(hello.status()).toBe(200);
  expect(await hello.text()).toBe("abc123");

  // Who may call
  expect((await send(message(team), { signed: false })).status()).toBe(401);
  expect((await send(message(team), { at: Date.now() - 10 * 60_000 })).status()).toBe(401);
  const forged = await request.post("/api/webhooks/slack", { data: JSON.stringify(message(team)), headers: { "content-type": "application/json", "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)), "x-slack-signature": "v0=" + "0".repeat(64) } });
  expect(forged.status()).toBe(401);

  // A real signed message for a known workspace, a repeat of it, an unknown workspace, and an event Relay ignores
  expect((await send(message(team))).status()).toBe(200);
  expect((await send(message(team))).status()).toBe(200);
  expect((await send(message("TNOBODY00"))).status()).toBe(200);
  expect((await send({ type: "event_callback", team_id: team, event: { type: "reaction_added" } })).status()).toBe(200);

  // The app being removed disconnects the workspace
  expect((await send({ type: "event_callback", team_id: team, event: { type: "app_uninstalled" } })).status()).toBe(200);
  const { data: after } = await owner.from("channels").select("status").eq("external_id", team).single();
  expect(after?.status).toBe("disconnected");
});
