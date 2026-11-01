import { describe, expect, it } from "vitest";
import viber, { explainViberStatus, parseViber, readViber, viberStatuses } from "./viber";
import type { ChannelRow } from "./types";

const creds = { auth_token: "tok" };
const channel: ChannelRow = { id: "ch", workspace_id: "w", type: "viber", settings: { sender_name: "Acme Support", welcome: "Welcome to Acme!" } };
const message = (m: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  event: "message", timestamp: 1_800_000_000_000, message_token: "4912661846655238145", sender: { id: "01234567890A=", name: "Ana", avatar: "x", country: "AE", language: "en", api_version: 8 }, message: m, ...over,
});

describe("reading a Viber message", () => {
  it("files text with the sender's name and the message token as its id", () => {
    const [m] = parseViber(message({ type: "text", text: "Hello" }));
    expect(m).toMatchObject({ kind: "viber", address: "01234567890A=", display: "Ana", externalId: "4912661846655238145", type: "text", body: "Hello", threadKey: "", replyTo: null });
    expect(m!.sentAt.getTime()).toBe(1_800_000_000_000);
  });

  it("files a picture with its caption, and a file with its name", () => {
    const [p] = parseViber(message({ type: "picture", text: "My receipt", media: "https://cdn.viber.example/p.jpg" }));
    expect(p).toMatchObject({ type: "image", body: null, caption: "My receipt" });
    expect(p!.media![0]).toMatchObject({ ref: { id: "4912661846655238145", url: "https://cdn.viber.example/p.jpg" }, mime: "image/jpeg" });
    const [f] = parseViber(message({ type: "file", media: "https://cdn.viber.example/f.pdf", file_name: "order.pdf", size: 5 }));
    expect(f).toMatchObject({ type: "document" });
    expect(f!.media![0]).toMatchObject({ filename: "order.pdf" });
    expect(parseViber(message({ type: "video", media: "https://cdn.viber.example/v.mp4" }))[0]).toMatchObject({ type: "video" });
  });

  it("files a location", () => {
    expect(parseViber(message({ type: "location", location: { lat: 25.18, lon: 55.27 } }))[0]).toMatchObject({ type: "location", data: { latitude: 25.18, longitude: 55.27 } });
    expect(parseViber(message({ type: "location", location: {} }))).toEqual([]);
  });

  it("files stickers, contacts and links as unsupported so nothing is lost", () => {
    for (const type of ["sticker", "contact", "url", "rich_media"]) expect(parseViber(message({ type }))[0]).toMatchObject({ type: "unsupported" });
    expect(parseViber(message({ type: "picture" }))[0]).toMatchObject({ type: "unsupported" });
  });

  it("skips other events, empty text and junk", () => {
    expect(parseViber({ event: "delivered", message_token: "1", user_id: "u" })).toEqual([]);
    expect(parseViber({ event: "conversation_started", user: { id: "u" } })).toEqual([]);
    expect(parseViber(message({ type: "text", text: "" }))).toEqual([]);
    expect(parseViber(message({ type: "text", text: "x" }, { sender: {} }))).toEqual([]);
    expect(parseViber(null)).toEqual([]);
  });
});

describe("delivery callbacks", () => {
  it("maps delivered, seen and failed to the message they refer to", () => {
    expect(viberStatuses({ event: "delivered", message_token: "9", user_id: "u" })).toEqual([{ externalId: "9", status: "delivered" }]);
    expect(viberStatuses({ event: "seen", message_token: "9", user_id: "u" })).toEqual([{ externalId: "9", status: "read" }]);
    expect(viberStatuses({ event: "failed", message_token: "9", user_id: "u", desc: "unsupported media" })).toEqual([{ externalId: "9", status: "failed", errorText: "Viber couldn't show this message: unsupported media." }]);
    expect(viberStatuses({ event: "message", message_token: "9" })).toEqual([]);
    expect(viberStatuses({ event: "delivered" })).toEqual([]);
  });
});

describe("reading Viber's answers", () => {
  it("keeps a 64-bit message token exact", () => {
    expect(readViber('{"status":0,"status_message":"ok","message_token":5098034272017990000,"chat_hostname":"SN-1"}').message_token).toBe("5098034272017990000");
    expect(readViber('{"status":0,"message_token":4912661846655238145}').message_token).toBe("4912661846655238145");
    expect(readViber('{"status":0,"message_token":"123"}').message_token).toBe("123");
  });
  it("copes with an unreadable answer", () => {
    expect(readViber("<html>")).toEqual({});
  });
});

describe("sending", () => {
  const req = (over: Record<string, unknown> = {}) => ({ messageId: "m", body: "On it!", to: "01234567890A=", threadKey: "", settings: channel.settings, lastInbound: null, lastInboundAt: null, ...over });
  const answers = (raw: string, status = 200) => {
    const seen: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      seen.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
      return new Response(raw, { status });
    }) as unknown as typeof fetch;
    return { f, seen };
  };

  it("sends text as the account, with the token in Viber's header, and returns the message token", async () => {
    const { f, seen } = answers('{"status":0,"status_message":"ok","message_token":4912661846655238146}');
    expect(await viber.send(f, creds, req())).toEqual({ externalId: "4912661846655238146" });
    expect(seen[0]).toEqual({
      url: "https://chatapi.viber.com/pa/send_message", headers: { "x-viber-auth-token": "tok", "content-type": "application/json" },
      body: { receiver: "01234567890A=", min_api_version: 1, sender: { name: "Acme Support" }, type: "text", text: "On it!" },
    });
  });

  it("cuts the sender name at 28 characters, and the text at 7,000", async () => {
    const { f, seen } = answers('{"status":0,"message_token":1}');
    await viber.send(f, creds, req({ settings: { sender_name: "N".repeat(60) }, body: "a".repeat(8000) }));
    expect((seen[0]!.body.sender as { name: string }).name).toHaveLength(28);
    expect((seen[0]!.body.text as string)).toHaveLength(7000);
  });

  it("uses a plain sender name when none is set", async () => {
    const { f, seen } = answers('{"status":0,"message_token":1}');
    await viber.send(f, creds, req({ settings: {} }));
    expect((seen[0]!.body.sender as { name: string }).name).toBe("Support");
  });

  it.each([
    [2, "bad_credentials", false],
    [6, "not_subscribed", false],
    [5, "not_registered", false],
    [12, "rate_limited", true],
    [23, "billing_23", false],
    [99, "status_99", false],
  ])("explains status %i", async (status, code, temporary) => {
    const { f } = answers(JSON.stringify({ status, status_message: "x" }));
    await expect(viber.send(f, creds, req())).rejects.toMatchObject({ code, temporary });
  });

  it("retries a Viber outage or an unreachable Viber", async () => {
    await expect(viber.send(answers("{}", 503).f, creds, req())).rejects.toMatchObject({ temporary: true });
    await expect(viber.send((async () => { throw new Error("offline"); }) as unknown as typeof fetch, creds, req())).rejects.toMatchObject({ temporary: true });
  });

  it("says what Viber said for a code it doesn't know", () => {
    expect(explainViberStatus(77, "odd")).toMatchObject({ code: "status_77", message: "Viber refused the message (code 77). Viber says: odd" });
  });
});

describe("the welcome message", () => {
  const started = { event: "conversation_started", user: { id: "u1", name: "Ana" }, type: "open", subscribed: false };

  it("sends the owner's welcome to the person who opened the conversation", async () => {
    const seen: Record<string, unknown>[] = [];
    const f = (async (_u: string, init: RequestInit) => { seen.push(JSON.parse(String(init.body))); return new Response('{"status":0,"message_token":1}'); }) as unknown as typeof fetch;
    await viber.welcome!(f, creds, started, channel);
    expect(seen).toEqual([{ receiver: "u1", min_api_version: 1, sender: { name: "Acme Support" }, type: "text", text: "Welcome to Acme!" }]);
  });

  it("sends nothing when no welcome is set or for other events", async () => {
    let called = 0;
    const f = (async () => { called++; return new Response('{"status":0}'); }) as unknown as typeof fetch;
    await viber.welcome!(f, creds, started, { ...channel, settings: { sender_name: "A" } });
    await viber.welcome!(f, creds, { event: "subscribed", user: { id: "u1" } }, channel);
    expect(called).toBe(0);
  });

  it("reports a refusal", async () => {
    const f = (async () => new Response('{"status":6,"status_message":"receiverNotSubscribed"}')) as unknown as typeof fetch;
    await expect(viber.welcome!(f, creds, started, channel)).rejects.toMatchObject({ code: "not_subscribed" });
  });
});

describe("downloading a file", () => {
  it("never fetches a private or non-https address", async () => {
    for (const url of ["http://cdn.example/x", "https://127.0.0.1/x", "https://169.254.169.254/x", "not a url", ""]) {
      await expect(viber.download!(fetch, creds, { id: "1", url })).rejects.toThrow();
    }
  });
});
