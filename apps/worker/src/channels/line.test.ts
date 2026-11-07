import { describe, expect, it } from "vitest";
import line, { explainLineError, parseLineMessages } from "./line";
import { ChannelSendError } from "./types";

const channel = { id: "ch1", workspace_id: "w1", type: "line", settings: { greeting: "Welcome! How can we help?" } };
const creds = { access_token: "tok", channel_secret: "sec" };
const BOT = "U" + "a".repeat(32);
const USER = "U" + "b".repeat(32);
const webhook = (...events: Record<string, unknown>[]) => ({ destination: BOT, events });
const message = (m: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: "message", mode: "active", timestamp: 1_793_000_000_000, webhookEventId: "01H", deliveryContext: { isRedelivery: false },
  source: { type: "user", userId: USER }, replyToken: "rt-1", message: { id: "100", ...m }, ...extra,
});
const parse = (m: Record<string, unknown>, extra?: Record<string, unknown>) => parseLineMessages(webhook(message(m, extra)), channel);

describe("reading a LINE message", () => {
  it("maps a text message, addressed by the person's user id", () => {
    const [m] = parse({ type: "text", text: "Hello" });
    expect(m).toMatchObject({ kind: "line", address: USER, externalId: `${BOT}:100`, type: "text", body: "Hello", threadKey: "", replyTo: null });
    expect(m!.sentAt.getTime()).toBe(1_793_000_000_000);
    expect(m!.data).toEqual({ reply_token: "rt-1", line_event: "01H" });
  });

  it("keeps the id unique per account and message", () => {
    expect(parseLineMessages({ destination: "U" + "c".repeat(32), events: [message({ type: "text", text: "x" })] }, channel)[0]!.externalId).toBe(`U${"c".repeat(32)}:100`);
  });

  it("links a quoted message", () => {
    expect(parse({ type: "text", text: "yes", quotedMessageId: "77" })[0]!.replyTo).toBe(`${BOT}:77`);
  });

  it("queues a download for images, video, audio and files that LINE keeps", () => {
    expect(parse({ type: "image", contentProvider: { type: "line" } })[0]).toMatchObject({ type: "image", media: [{ ref: { id: "100" } }] });
    expect(parse({ type: "video", duration: 5000, contentProvider: { type: "line" } })[0]).toMatchObject({ type: "video", data: { duration_ms: 5000 } });
    expect(parse({ type: "audio", duration: 3000, contentProvider: { type: "line" } })[0]).toMatchObject({ type: "audio" });
    const [f] = parse({ type: "file", fileName: "invoice.pdf", fileSize: 12345 });
    expect(f).toMatchObject({ type: "document" });
    expect(f!.media![0]).toMatchObject({ ref: { id: "100", file_size: 12345 }, filename: "invoice.pdf" });
  });

  it("does not try to download a file that is only a link", () => {
    expect(parse({ type: "image", contentProvider: { type: "external", originalContentUrl: "https://x/a.png" } })[0]!.media).toEqual([]);
  });

  it("keeps a set of images together", () => {
    expect(parse({ type: "image", contentProvider: { type: "line" }, imageSet: { id: "s1", index: 1, total: 3 } })[0]!.data).toMatchObject({ image_set: { id: "s1", index: 1, total: 3 } });
  });

  it("maps a location into the same shape WhatsApp uses", () => {
    expect(parse({ type: "location", title: "Our shop", address: "1 Main St", latitude: 35.68, longitude: 139.76 })[0]).toMatchObject({
      type: "location", body: "Our shop", data: { latitude: 35.68, longitude: 139.76, name: "Our shop", address: "1 Main St" },
    });
  });

  it("shows that a sticker arrived without pretending to have its picture", () => {
    const [s] = parse({ type: "sticker", packageId: "1", stickerId: "2" });
    expect(s).toMatchObject({ type: "sticker", body: null, data: { package_id: "1", sticker_id: "2" } });
    expect(s!.media).toBeUndefined();
  });

  it("still shows that something arrived when it is a kind we don't handle", () => {
    expect(parse({ type: "hologram" })[0]).toMatchObject({ type: "unsupported", data: { original_type: "hologram" } });
  });

  it("ignores groups, rooms, standby mode, other events and an empty verification call", () => {
    expect(parseLineMessages(webhook(message({ type: "text", text: "x" }, { source: { type: "group", groupId: "G1", userId: USER } })), channel)).toEqual([]);
    expect(parseLineMessages(webhook(message({ type: "text", text: "x" }, { source: { type: "room", roomId: "R1", userId: USER } })), channel)).toEqual([]);
    expect(parse({ type: "text", text: "x" }, { mode: "standby" })).toEqual([]);
    expect(parseLineMessages(webhook({ type: "follow", source: { type: "user", userId: USER }, replyToken: "r" }), channel)).toEqual([]);
    expect(parseLineMessages({ destination: BOT, events: [] }, channel)).toEqual([]);
    expect(parseLineMessages(null, channel)).toEqual([]);
  });

  it("files several events from one webhook", () => {
    const body = webhook(message({ type: "text", text: "a" }), message({ id: "101", type: "text", text: "b" }));
    expect(parseLineMessages(body, channel).map((m) => m.body)).toEqual(["a", "b"]);
  });
});

describe("blocks and re-adds", () => {
  const ev = (type: string, extra: Record<string, unknown> = {}) => webhook({ type, mode: "active", source: { type: "user", userId: USER }, replyToken: "rt", ...extra });

  it("notes a block from the unfollow event", () => {
    expect(line.events!(ev("unfollow"), channel, creds)).toEqual([{ kind: "blocked", identityKind: "line", address: USER }]);
  });

  it("notes an unblock, but not a first add", () => {
    expect(line.events!(ev("follow", { follow: { isUnblocked: true } }), channel, creds)).toEqual([{ kind: "unblocked", identityKind: "line", address: USER }]);
    expect(line.events!(ev("follow", { follow: { isUnblocked: false } }), channel, creds)).toEqual([]);
    expect(line.events!(ev("follow"), channel, creds)).toEqual([]);
  });

  it("does not file a follow as a conversation", () => {
    expect(parseLineMessages(ev("follow"), channel)).toEqual([]);
  });
});

/** A fake of LINE's server that records what it was asked. */
function fakeLine(answers: Record<string, { status?: number; body?: unknown; bytes?: Uint8Array; headers?: Record<string, string> }>) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : {} });
    const key = Object.keys(answers).find((k) => u.includes(k));
    const a = key ? answers[key]! : { status: 404, body: {} };
    return new Response(a.bytes ?? JSON.stringify(a.body ?? {}), { status: a.status ?? 200, ...(a.headers ? { headers: a.headers } : {}) });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const req = (over: Record<string, unknown> = {}) => ({
  messageId: "5d9c8f1e-aaaa-bbbb-cccc-000000000001", body: "Hello Mika", to: USER, threadKey: "", settings: {},
  lastInbound: { reply_token: "rt-live" }, lastInboundAt: new Date(), ...over,
});

describe("replying on LINE", () => {
  it("uses the free reply while the customer's message is fresh", async () => {
    const { f, calls } = fakeLine({ "/message/reply": { body: {} } });
    expect(await line.send(f, creds, req())).toEqual({ externalId: "line-reply:5d9c8f1e-aaaa-bbbb-cccc-000000000001" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.line.me/v2/bot/message/reply");
    expect(calls[0]!.body).toEqual({ replyToken: "rt-live", messages: [{ type: "text", text: "Hello Mika" }] });
    expect(calls[0]!.headers.authorization).toBe("Bearer tok");
  });

  it("pushes when the customer's message is older than the free window, with a retry key", async () => {
    const { f, calls } = fakeLine({ "/message/push": { body: { sentMessages: [{ id: "L-9" }] } } });
    const out = await line.send(f, creds, req({ lastInboundAt: new Date(Date.now() - 5 * 60_000) }));
    expect(out).toEqual({ externalId: "L-9" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.line.me/v2/bot/message/push");
    expect(calls[0]!.body).toEqual({ to: USER, messages: [{ type: "text", text: "Hello Mika" }] });
    expect(calls[0]!.headers["X-Line-Retry-Key"]).toBe("5d9c8f1e-aaaa-bbbb-cccc-000000000001");
  });

  it("pushes when there is no reply token", async () => {
    const { f, calls } = fakeLine({ "/message/push": { body: {} } });
    await line.send(f, creds, req({ lastInbound: null }));
    expect(calls.map((c) => c.url)).toEqual(["https://api.line.me/v2/bot/message/push"]);
  });

  it("falls back to a push when LINE says the reply token was already used", async () => {
    const { f, calls } = fakeLine({ "/message/reply": { status: 400, body: { message: "Invalid reply token" } }, "/message/push": { body: {} } });
    const out = await line.send(f, creds, req());
    expect(out.externalId).toBe("line-push:5d9c8f1e-aaaa-bbbb-cccc-000000000001");
    expect(calls.map((c) => c.url)).toEqual(["https://api.line.me/v2/bot/message/reply", "https://api.line.me/v2/bot/message/push"]);
  });

  it("treats a repeated retry key as already sent, never sending twice", async () => {
    const { f } = fakeLine({ "/message/push": { status: 409, body: { message: "The retry key is already accepted" } } });
    expect((await line.send(f, creds, req({ lastInbound: null }))).externalId).toBe("line-push:5d9c8f1e-aaaa-bbbb-cccc-000000000001");
  });

  it("cuts a message at LINE's 5000-character limit", async () => {
    const { f, calls } = fakeLine({ "/message/push": { body: {} } });
    await line.send(f, creds, req({ lastInbound: null, body: "a".repeat(6000) }));
    expect(((calls[0]!.body.messages as { text: string }[])[0]!).text).toHaveLength(5000);
  });

  it("says plainly when the monthly allowance is used up, and does not retry", () => {
    const e = explainLineError(429, { message: "You have reached your monthly limit." });
    expect(e).toMatchObject({ code: "monthly_limit", temporary: false });
    expect(e.message).toMatch(/monthly message limit/);
  });

  it("retries a plain rate limit and a LINE outage", () => {
    expect(explainLineError(429, {})).toMatchObject({ code: "rate_limited", temporary: true });
    expect(explainLineError(503, {})).toMatchObject({ temporary: true });
  });

  it("tells the owner to reconnect when the token is refused", () => {
    expect(explainLineError(401, { message: "Authentication failed" })).toMatchObject({ code: "bad_token", temporary: false });
  });

  it("passes on LINE's own words when it doesn't recognise the refusal", () => {
    const e = explainLineError(400, { message: "The property 'to' is invalid" });
    expect(e.message).toContain("The property 'to' is invalid");
    expect(e.temporary).toBe(false);
  });

  it("never lets the token into an error when LINE can't be reached", async () => {
    const down = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    const err = await line.send(down, creds, req({ lastInbound: null })).catch((e) => e);
    expect(err).toBeInstanceOf(ChannelSendError);
    expect(err).toMatchObject({ code: "unreachable", temporary: true });
    expect(err.message).not.toContain("tok");
  });
});

describe("the greeting", () => {
  const follow = webhook({ type: "follow", mode: "active", source: { type: "user", userId: USER }, replyToken: "rt-follow" });

  it("is sent free with the follow event's reply token", async () => {
    const { f, calls } = fakeLine({ "/message/reply": { body: {} } });
    await line.welcome!(f, creds, follow, channel);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ replyToken: "rt-follow", messages: [{ type: "text", text: "Welcome! How can we help?" }] });
  });

  it("is not sent when none is set, for a message, or in a group", async () => {
    const { f, calls } = fakeLine({});
    await line.welcome!(f, creds, follow, { ...channel, settings: {} });
    await line.welcome!(f, creds, webhook(message({ type: "text", text: "hi" })), channel);
    await line.welcome!(f, creds, webhook({ type: "follow", source: { type: "group", groupId: "G" }, replyToken: "r" }), channel);
    expect(calls).toHaveLength(0);
  });

  it("reports a refusal so it is logged", async () => {
    const { f } = fakeLine({ "/message/reply": { status: 400, body: { message: "Invalid reply token" } } });
    await expect(line.welcome!(f, creds, follow, channel)).rejects.toBeInstanceOf(ChannelSendError);
  });
});

describe("the customer's name", () => {
  it("comes from LINE's profile endpoint", async () => {
    const { f, calls } = fakeLine({ "/v2/bot/profile/": { body: { displayName: "Mika", userId: USER } } });
    expect(await line.profile!(f, creds, USER)).toBe("Mika");
    expect(calls[0]!.url).toBe(`https://api.line.me/v2/bot/profile/${USER}`);
  });

  it("is left blank, never invented, when LINE won't say", async () => {
    expect(await line.profile!(fakeLine({ "/v2/bot/profile/": { status: 404, body: {} } }).f, creds, USER)).toBeUndefined();
    expect(await line.profile!(fakeLine({ "/v2/bot/profile/": { body: {} } }).f, creds, USER)).toBeUndefined();
  });
});

describe("downloading a LINE file", () => {
  it("fetches it from LINE's data server with the token and keeps its type", async () => {
    const { f, calls } = fakeLine({ "/content": { bytes: new Uint8Array([1, 2, 3]), headers: { "content-type": "image/jpeg" } } });
    const out = await line.download!(f, creds, { id: "100" });
    expect(out.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(out.mime).toBe("image/jpeg");
    expect(calls[0]!.url).toBe("https://api-data.line.me/v2/bot/message/100/content");
    expect(calls[0]!.headers.authorization).toBe("Bearer tok");
  });

  it("retries while LINE is still preparing a large file", async () => {
    await expect(line.download!(fakeLine({ "/content": { status: 202 } }).f, creds, { id: "100" })).rejects.toThrow(/still preparing/);
  });

  it("says when LINE has deleted the file", async () => {
    await expect(line.download!(fakeLine({ "/content": { status: 410 } }).f, creds, { id: "100" })).rejects.toThrow(/deletes files/);
    await expect(line.download!(fakeLine({ "/content": { status: 404 } }).f, creds, { id: "100" })).rejects.toThrow(/no longer has/);
  });

  it("refuses an oversized file before asking for it", async () => {
    const { f, calls } = fakeLine({});
    await expect(line.download!(f, creds, { id: "1", file_size: 60 * 1024 * 1024 })).rejects.toThrow(/50 MB/);
    expect(calls).toHaveLength(0);
  });
});
