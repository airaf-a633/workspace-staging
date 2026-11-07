import { beforeEach, describe, expect, it } from "vitest";
import slack, { explainSlackError, forgetPeople, parseSlack, whoWrote } from "./slack";
import { ChannelSendError, type ChannelRow } from "./types";

const channel: ChannelRow = { id: "ch1", workspace_id: "ws", type: "slack", settings: { team_id: "T_OURS", bot_user_id: "U_BOT" } };
const message = (over: Record<string, unknown> = {}) => ({
  type: "event_callback",
  team_id: "T_OURS",
  event_id: "Ev1",
  event: { type: "message", channel: "C1", channel_type: "channel", user: "U_ANA", text: "Hello", ts: "1700000000.000200", ...over },
});
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("reading a Slack message", () => {
  it("maps a message to a chat per person per Slack channel", () => {
    const [m] = parseSlack(message(), channel);
    expect(m).toMatchObject({
      kind: "slack", address: "U_ANA", externalId: "C1:1700000000.000200", type: "text", body: "Hello",
      threadKey: "C1", replyTo: null, data: { channel: "C1", ts: "1700000000.000200" },
    });
    expect(m!.sentAt.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });

  it("points a reply at its parent and remembers the thread", () => {
    const [m] = parseSlack(message({ ts: "1700000005.000100", thread_ts: "1700000000.000200" }), channel);
    expect(m).toMatchObject({ replyTo: "C1:1700000000.000200", data: { thread_ts: "1700000000.000200" } });
  });

  it("does not treat the first message of a thread as a reply to itself", () => {
    expect(parseSlack(message({ thread_ts: "1700000000.000200" }), channel)[0]!.replyTo).toBeNull();
  });

  it("works in private channels too", () => {
    expect(parseSlack(message({ channel: "G9", channel_type: "group" }), channel)).toHaveLength(1);
  });

  it("maps files, keeping the words as the caption", () => {
    const [m] = parseSlack(message({ subtype: "file_share", text: "My receipt", files: [{ id: "F1", name: "r.png", mimetype: "image/png", size: 99, url_private: "https://files.slack.com/files-pri/T-F1/r.png" }, { id: "F2", name: "b.pdf", mimetype: "application/pdf" }] }), channel);
    expect(m).toMatchObject({ type: "image", body: null, caption: "My receipt" });
    expect(m!.media).toHaveLength(2);
    expect(m!.media![0]).toMatchObject({ ref: { id: "F1", url: "https://files.slack.com/files-pri/T-F1/r.png", size: 99 }, mime: "image/png", filename: "r.png" });
  });

  it("files a file that arrived without its address, so the worker can ask Slack for it", () => {
    const [m] = parseSlack(message({ subtype: "file_share", text: "", files: [{ id: "F3", name: "x.pdf", mimetype: "application/pdf", file_access: "check_file_info" }] }), channel);
    expect(m!.media![0]!.ref).toEqual({ id: "F3" });
  });

  it("never stores a link to another site as a file", () => {
    expect(parseSlack(message({ subtype: "file_share", text: "", files: [{ id: "F4", mode: "external", is_external: true, url_private: "https://evil.example/x" }] }), channel)).toEqual([]);
  });

  it.each([
    ["a bot message", { subtype: "bot_message" }],
    ["Relay's own message", { user: "U_BOT" }],
    ["a bot's id", { bot_id: "B1" }],
    ["a join", { subtype: "channel_join" }],
    ["an edit", { subtype: "message_changed" }],
    ["a delete", { subtype: "message_deleted" }],
    ["a direct message", { channel_type: "im", channel: "D1" }],
    ["a group direct message", { channel_type: "mpim", channel: "G2" }],
    ["no text and no files", { text: "" }],
    ["no sender", { user: undefined }],
  ])("skips %s", (_name, over) => {
    expect(parseSlack(message(over), channel)).toEqual([]);
  });

  it("skips other events and junk", () => {
    expect(parseSlack({ type: "url_verification", challenge: "x" }, channel)).toEqual([]);
    expect(parseSlack({ type: "event_callback", event: { type: "reaction_added" } }, channel)).toEqual([]);
    expect(parseSlack(null, channel)).toEqual([]);
  });
});

describe("telling customers from staff", () => {
  beforeEach(() => forgetPeople());
  const asks: string[] = [];
  const slackSays = (user: Record<string, unknown> | { error: string }) =>
    (async (url: string) => {
      asks.push(url);
      return "error" in user ? json({ ok: false, error: user.error }) : json({ ok: true, user });
    }) as unknown as typeof fetch;
  const creds = { bot_token: "xoxb-test" };

  it("treats a person from another workspace as a customer, with their name", async () => {
    const who = await whoWrote(slackSays({ team_id: "T_THEIRS", real_name: "Ana Ruiz", profile: { display_name: "Ana" } }), creds, channel, "U_ANA");
    expect(who).toEqual({ side: "customer", display: "Ana" });
  });

  it("falls back to the real name", async () => {
    expect(await whoWrote(slackSays({ team_id: "T_THEIRS", real_name: "Ana Ruiz", profile: { display_name: "" } }), creds, channel, "U_ANA")).toEqual({ side: "customer", display: "Ana Ruiz" });
  });

  it("treats someone from the installed workspace as staff", async () => {
    expect(await whoWrote(slackSays({ team_id: "T_OURS", real_name: "Hana" }), creds, channel, "U_HANA")).toEqual({ side: "team" });
  });

  it("treats a stranger as a customer even when the workspace id matches", async () => {
    expect((await whoWrote(slackSays({ team_id: "T_OURS", is_stranger: true, real_name: "Zed" }), creds, channel, "U_ZED")).side).toBe("customer");
  });

  it("skips a bot", async () => {
    expect(await whoWrote(slackSays({ team_id: "T_THEIRS", is_bot: true }), creds, channel, "U_APP")).toEqual({ side: "skip" });
  });

  it("shows a person Slack won't describe as a customer without a name", async () => {
    expect(await whoWrote(slackSays({ error: "user_not_visible" }), creds, channel, "U_X")).toEqual({ side: "customer" });
  });

  it("retries rather than guessing when Slack fails", async () => {
    const limited = (async () => json({ ok: false, error: "ratelimited" }, 429)) as unknown as typeof fetch;
    await expect(whoWrote(limited, creds, channel, "U_Y")).rejects.toMatchObject({ temporary: true, code: "rate_limited" });
    const revoked = (async () => json({ ok: false, error: "token_revoked" })) as unknown as typeof fetch;
    await expect(whoWrote(revoked, creds, channel, "U_Z")).rejects.toMatchObject({ code: "bad_credentials" });
  });

  it("asks Slack once per person for ten minutes", async () => {
    asks.length = 0;
    const f = slackSays({ team_id: "T_THEIRS", real_name: "Ana" });
    await whoWrote(f, creds, channel, "U_ANA", 1_000);
    await whoWrote(f, creds, channel, "U_ANA", 2_000);
    expect(asks).toHaveLength(1);
    await whoWrote(f, creds, channel, "U_ANA", 1_000 + 11 * 60_000);
    expect(asks).toHaveLength(2);
    expect(asks[0]).toContain("users.info?user=U_ANA");
  });
});

describe("sending", () => {
  const req = (over: Record<string, unknown> = {}) => ({ messageId: "m", body: "On it!", to: "U_ANA", threadKey: "C1", settings: {}, lastInbound: { channel: "C1", ts: "1700000000.000200" }, lastInboundAt: new Date(), ...over });
  const creds = { bot_token: "xoxb-test" };

  it("posts into the thread of the customer's latest message and returns the new message's id", async () => {
    let sent: { url: string; auth: string; body: URLSearchParams } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      sent = { url, auth: (init.headers as Record<string, string>).authorization!, body: new URLSearchParams(String(init.body)) };
      return json({ ok: true, channel: "C1", ts: "1700000099.000300" });
    }) as unknown as typeof fetch;
    expect(await slack.send(f, creds, req())).toEqual({ externalId: "C1:1700000099.000300" });
    expect(sent!.url).toBe("https://slack.com/api/chat.postMessage");
    expect(sent!.auth).toBe("Bearer xoxb-test");
    expect(Object.fromEntries(sent!.body)).toEqual({ channel: "C1", text: "On it!", thread_ts: "1700000000.000200" });
  });

  it("answers in the thread's parent when the customer wrote inside a thread", async () => {
    let body!: URLSearchParams;
    const f = (async (_u: string, init: RequestInit) => { body = new URLSearchParams(String(init.body)); return json({ ok: true, channel: "C1", ts: "9.1" }); }) as unknown as typeof fetch;
    await slack.send(f, creds, req({ lastInbound: { channel: "C1", ts: "1700000005.000100", thread_ts: "1700000000.000200" } }));
    expect(body.get("thread_ts")).toBe("1700000000.000200");
  });

  it("cuts a message at 4,000 characters", async () => {
    let body!: URLSearchParams;
    const f = (async (_u: string, init: RequestInit) => { body = new URLSearchParams(String(init.body)); return json({ ok: true, channel: "C1", ts: "9.1" }); }) as unknown as typeof fetch;
    await slack.send(f, creds, req({ body: "a".repeat(5000) }));
    expect(body.get("text")).toHaveLength(4000);
  });

  it("refuses without a Slack channel", async () => {
    await expect(slack.send(fetch, creds, req({ threadKey: "" }))).rejects.toBeInstanceOf(ChannelSendError);
  });

  it("explains Slack's refusals in plain words", async () => {
    const refuse = (error: string, status = 200) => (async () => json({ ok: false, error }, status)) as unknown as typeof fetch;
    await expect(slack.send(refuse("not_in_channel"), creds, req())).rejects.toMatchObject({ code: "not_in_channel", temporary: false, message: expect.stringContaining("isn't in this channel") });
    await expect(slack.send(refuse("is_archived"), creds, req())).rejects.toMatchObject({ message: expect.stringContaining("archived") });
    await expect(slack.send(refuse("invalid_auth"), creds, req())).rejects.toMatchObject({ code: "bad_credentials" });
    await expect(slack.send(refuse("restricted_action_thread_locked"), creds, req())).rejects.toMatchObject({ message: expect.stringContaining("don't allow") });
    await expect(slack.send(refuse("ratelimited", 429), creds, req())).rejects.toMatchObject({ temporary: true });
    await expect(slack.send(refuse("fatal_error", 503), creds, req())).rejects.toMatchObject({ temporary: true });
  });

  it("says what Slack said for an error it doesn't know", () => {
    expect(explainSlackError(200, "something_new")).toMatchObject({ code: "something_new", message: "Slack refused the message (something_new)." });
  });

  it("retries when Slack can't be reached", async () => {
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await expect(slack.send(down, creds, req())).rejects.toMatchObject({ temporary: true });
  });
});

describe("downloading a file", () => {
  const creds = { bot_token: "xoxb-test" };
  const file = "https://files.slack.com/files-pri/T-F1/r.png";

  it("sends the key to files.slack.com only, without following redirects", async () => {
    let seen: { url: string; auth: string; redirect: string | undefined } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, auth: (init.headers as Record<string, string>).authorization!, redirect: init.redirect };
      return new Response("png", { status: 200, headers: { "content-type": "image/png" } });
    }) as unknown as typeof fetch;
    const got = await slack.download!(f, creds, { id: "F1", url: file });
    expect(seen).toEqual({ url: file, auth: "Bearer xoxb-test", redirect: "manual" });
    expect(got.mime).toBe("image/png");
    expect(new TextDecoder().decode(got.bytes)).toBe("png");
  });

  it("never sends the key to another host, a lookalike, or plain http", async () => {
    const never = (async () => { throw new Error("must not be called"); }) as unknown as typeof fetch;
    for (const url of ["https://evil.example/x", "https://files.slack.com.evil.example/x", "http://files.slack.com/x", "https://evilfiles.slack.com/x", "not a url"]) {
      await expect(slack.download!(never, creds, { id: "F1", url })).rejects.toThrow();
    }
  });

  it("does not follow a redirect", async () => {
    const f = (async () => new Response(null, { status: 302, headers: { location: "https://evil.example" } })) as unknown as typeof fetch;
    await expect(slack.download!(f, creds, { id: "F1", url: file })).rejects.toThrow(/somewhere else/);
  });

  it("asks Slack for the address when the file arrived without one", async () => {
    const calls: string[] = [];
    const f = (async (url: string) => {
      calls.push(url);
      return url.includes("files.info") ? json({ ok: true, file: { id: "F3", url_private_download: "https://files.slack.com/files-pri/T-F3/x.pdf" } }) : new Response("pdf", { status: 200, headers: { "content-type": "application/pdf" } });
    }) as unknown as typeof fetch;
    const got = await slack.download!(f, creds, { id: "F3" });
    expect(calls[0]).toBe("https://slack.com/api/files.info?file=F3");
    expect(calls[1]).toBe("https://files.slack.com/files-pri/T-F3/x.pdf");
    expect(got.mime).toBe("application/pdf");
  });

  it("explains a web page instead of the file, and a refusal", async () => {
    const page = (async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })) as unknown as typeof fetch;
    await expect(slack.download!(page, creds, { id: "F1", url: file })).rejects.toThrow(/web page/);
    const no = (async () => new Response("", { status: 403 })) as unknown as typeof fetch;
    await expect(slack.download!(no, creds, { id: "F1", url: file })).rejects.toThrow(/\(403\)/);
  });
});
