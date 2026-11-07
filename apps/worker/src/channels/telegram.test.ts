import { describe, expect, it } from "vitest";
import telegram, { explainTelegramError, isStart, parseTelegramUpdate } from "./telegram";
import { ChannelSendError } from "./types";

const channel = { id: "ch1", workspace_id: "w1", type: "telegram", settings: { greeting: "Hi! How can we help?" } };
const creds = { bot_token: "777:ABC", secret_token: "s" };
const chat = { id: 4242, type: "private", first_name: "Ana", last_name: "Silva", username: "ana_s" };
const update = (message: Record<string, unknown>) => ({ update_id: 1, message: { message_id: 10, date: 1_793_000_000, chat, from: { id: 4242, is_bot: false, first_name: "Ana", language_code: "pt" }, ...message } });
const parse = (message: Record<string, unknown>) => parseTelegramUpdate(update(message), channel, creds);

describe("reading a Telegram message", () => {
  it("maps a text message, addressed by the person's chat id", () => {
    const [m] = parse({ text: "Hello there" });
    expect(m).toMatchObject({
      kind: "telegram", address: "4242", display: "Ana Silva", externalId: "777:4242:10", type: "text", body: "Hello there", threadKey: "", replyTo: null,
      data: { username: "ana_s", language: "pt" },
    });
    expect(m!.sentAt.toISOString()).toBe(new Date(1_793_000_000 * 1000).toISOString());
  });

  it("falls back to the @username when there is no name, and invents nothing when there is neither", () => {
    expect(parseTelegramUpdate(update({ text: "x", chat: { id: 5, type: "private", username: "zed" }, from: { id: 5, is_bot: false } }), channel, creds)[0]!.display).toBe("@zed");
    expect(parseTelegramUpdate(update({ text: "x", chat: { id: 5, type: "private" }, from: { id: 5, is_bot: false } }), channel, creds)[0]!.display).toBeUndefined();
  });

  it("keeps the id unique per bot, chat and message", () => {
    const other = parseTelegramUpdate(update({ text: "x" }), channel, { bot_token: "888:XYZ" });
    expect(other[0]!.externalId).toBe("888:4242:10");
  });

  it("links a reply to the message it answers", () => {
    expect(parse({ text: "yes", reply_to_message: { message_id: 7 } })[0]!.replyTo).toBe("777:4242:7");
  });

  it("takes the largest photo and keeps its caption", () => {
    const [m] = parse({ caption: "My receipt", photo: [{ file_id: "small", width: 90, height: 60, file_size: 900 }, { file_id: "big", width: 1280, height: 960, file_size: 90_000 }, { file_id: "mid", width: 320, height: 240, file_size: 9_000 }] });
    expect(m).toMatchObject({ type: "image", body: null, caption: "My receipt" });
    expect(m!.media![0]).toMatchObject({ ref: { id: "big", file_size: 90_000 }, mime: "image/jpeg" });
  });

  it("maps documents with their name and type", () => {
    const [m] = parse({ document: { file_id: "d1", file_name: "invoice.pdf", mime_type: "application/pdf", file_size: 5000 } });
    expect(m).toMatchObject({ type: "document" });
    expect(m!.media![0]).toMatchObject({ ref: { id: "d1" }, mime: "application/pdf", filename: "invoice.pdf" });
  });

  it("maps voice notes, audio, video, video notes and animations", () => {
    expect(parse({ voice: { file_id: "v", duration: 3 } })[0]).toMatchObject({ type: "audio" });
    expect(parse({ voice: { file_id: "v", duration: 3 } })[0]!.media![0]!.mime).toBe("audio/ogg");
    expect(parse({ audio: { file_id: "a", duration: 3, file_name: "s.mp3", mime_type: "audio/mpeg" } })[0]).toMatchObject({ type: "audio" });
    expect(parse({ video: { file_id: "v", width: 1, height: 1, duration: 1 } })[0]).toMatchObject({ type: "video" });
    expect(parse({ video_note: { file_id: "n", length: 240, duration: 5 } })[0]).toMatchObject({ type: "video" });
    expect(parse({ animation: { file_id: "g", width: 1, height: 1, duration: 1 } })[0]).toMatchObject({ type: "video" });
  });

  it("maps locations and shared contacts into the same shapes WhatsApp uses", () => {
    expect(parse({ location: { latitude: 38.72, longitude: -9.14 } })[0]).toMatchObject({ type: "location", data: { latitude: 38.72, longitude: -9.14 } });
    expect(parse({ contact: { phone_number: "+351123", first_name: "Rui", last_name: "Costa" } })[0]).toMatchObject({
      type: "contacts", body: "Rui Costa", data: { contacts: [{ name: "Rui Costa", phones: ["+351123"] }] },
    });
  });

  it("keeps a sticker, with its emoji if it has one", () => {
    expect(parse({ sticker: { file_id: "s1", emoji: "👍" } })[0]).toMatchObject({ type: "sticker", body: "👍" });
    expect(parse({ sticker: { file_id: "s1" } })[0]).toMatchObject({ type: "sticker", body: null });
  });

  it("still shows that something arrived when it is a kind we don't handle", () => {
    expect(parse({ poll: { id: "p" } })[0]).toMatchObject({ type: "unsupported", data: { original_type: "poll" } });
  });

  it("does not file the Start button as a conversation", () => {
    for (const t of ["/start", "/start airplane", "/start@my_bot", " /START "]) expect(parse({ text: t })).toEqual([]);
    expect(parse({ text: "/starting now" })).toHaveLength(1);
  });

  it("ignores groups, bots, edits and anything that is not a message", () => {
    expect(parseTelegramUpdate(update({ text: "hi", chat: { id: -100, type: "supergroup", title: "G" } }), channel, creds)).toEqual([]);
    expect(parse({ text: "hi", from: { id: 9, is_bot: true, first_name: "Bot" } })).toEqual([]);
    expect(parseTelegramUpdate({ update_id: 2, edited_message: { message_id: 1, chat, text: "x" } }, channel, creds)).toEqual([]);
    expect(parseTelegramUpdate({ update_id: 3, my_chat_member: {} }, channel, creds)).toEqual([]);
    expect(parseTelegramUpdate(null, channel, creds)).toEqual([]);
    expect(parseTelegramUpdate({ message: { text: "no ids" } }, channel, creds)).toEqual([]);
  });

  it("recognises the Start command", () => {
    expect(isStart("/start")).toBe(true);
    expect(isStart("start")).toBe(false);
    expect(isStart(undefined)).toBe(false);
  });
});

/** A fake of Telegram's server that records what it was asked. */
function fakeTelegram(answers: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : {} });
    const key = Object.keys(answers).find((k) => u.includes(k));
    const a = key ? answers[key]! : { status: 404, body: { ok: false, description: "Not Found" } };
    if (a.body instanceof Uint8Array) return new Response(a.body, { status: a.status ?? 200 });
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const req = { messageId: "m1", body: "Hello Ana", to: "4242", threadKey: "", settings: {}, lastInbound: null, lastInboundAt: null };

describe("replying on Telegram", () => {
  it("sends plain text to the person's chat and records Telegram's message id", async () => {
    const { f, calls } = fakeTelegram({ sendMessage: { body: { ok: true, result: { message_id: 55 } } } });
    expect(await telegram.send(f, creds, req)).toEqual({ externalId: "777:4242:55" });
    expect(calls[0]!.url).toBe("https://api.telegram.org/bot777:ABC/sendMessage");
    expect(calls[0]!.body).toEqual({ chat_id: 4242, text: "Hello Ana" });
    expect(calls[0]!.body.parse_mode).toBeUndefined();
  });

  it("cuts a message at Telegram's 4096-character limit", async () => {
    const { f, calls } = fakeTelegram({ sendMessage: { body: { ok: true, result: { message_id: 1 } } } });
    await telegram.send(f, creds, { ...req, body: "a".repeat(5000) });
    expect(String(calls[0]!.body.text)).toHaveLength(4096);
  });

  it("says in plain words when the person blocked the bot, and does not retry", async () => {
    const { f } = fakeTelegram({ sendMessage: { status: 403, body: { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" } } });
    const err = await telegram.send(f, creds, req).catch((e) => e);
    expect(err).toBeInstanceOf(ChannelSendError);
    expect(err).toMatchObject({ code: "blocked", temporary: false });
    expect(err.message).toMatch(/blocked the bot/);
  });

  it("retries a rate limit and a Telegram outage", async () => {
    expect(explainTelegramError(429, { ok: false, parameters: { retry_after: 3 } })).toMatchObject({ code: "rate_limited", temporary: true });
    expect(explainTelegramError(502, { ok: false })).toMatchObject({ temporary: true });
  });

  it("tells the owner to reconnect when the token was revoked", () => {
    expect(explainTelegramError(401, { ok: false, description: "Unauthorized" })).toMatchObject({ code: "bad_token", temporary: false });
  });

  it("does not guess when it does not recognise the refusal: it passes on what Telegram said", () => {
    const e = explainTelegramError(400, { ok: false, description: "Bad Request: something new" });
    expect(e.message).toContain("something new");
    expect(e.temporary).toBe(false);
    expect(explainTelegramError(403, { ok: false, description: "Forbidden: something else" }).code).toBe("forbidden");
  });

  it("never lets the token into an error when Telegram can't be reached", async () => {
    const down = (async () => { throw new TypeError("fetch failed https://api.telegram.org/bot777:ABC/sendMessage"); }) as unknown as typeof fetch;
    const err = await telegram.send(down, creds, req).catch((e) => e);
    expect(err).toMatchObject({ code: "unreachable", temporary: true });
    expect(err.message).not.toContain("777");
  });
});

describe("the greeting", () => {
  it("is sent when someone presses Start, to that person only", async () => {
    const { f, calls } = fakeTelegram({ sendMessage: { body: { ok: true, result: { message_id: 1 } } } });
    await telegram.welcome!(f, creds, update({ text: "/start" }), channel);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ chat_id: 4242, text: "Hi! How can we help?" });
  });

  it("is not sent for a normal message, in a group, from a bot, or when none is set", async () => {
    const { f, calls } = fakeTelegram({});
    await telegram.welcome!(f, creds, update({ text: "hello" }), channel);
    await telegram.welcome!(f, creds, update({ text: "/start", chat: { id: -1, type: "group" } }), channel);
    await telegram.welcome!(f, creds, update({ text: "/start", from: { id: 1, is_bot: true } }), channel);
    await telegram.welcome!(f, creds, update({ text: "/start" }), { ...channel, settings: {} });
    expect(calls).toHaveLength(0);
  });
});

describe("downloading a Telegram file", () => {
  it("asks for the file's path, then fetches it", async () => {
    const { f, calls } = fakeTelegram({ getFile: { body: { ok: true, result: { file_path: "photos/file_9.jpg" } } }, "/file/bot": { body: new Uint8Array([1, 2, 3]) } });
    const out = await telegram.download!(f, creds, { id: "big", file_size: 90_000 });
    expect(out.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(out.filename).toBe("file_9.jpg");
    expect(calls[0]!.body).toEqual({ file_id: "big" });
    expect(calls[1]!.url).toBe("https://api.telegram.org/file/bot777:ABC/photos/file_9.jpg");
  });

  it("refuses a file over Telegram's 20 MB limit before asking, and says why", async () => {
    const { f, calls } = fakeTelegram({});
    await expect(telegram.download!(f, creds, { id: "huge", file_size: 21 * 1024 * 1024 })).rejects.toThrow(/20 MB/);
    expect(calls).toHaveLength(0);
  });

  it("explains a refusal from Telegram", async () => {
    const { f } = fakeTelegram({ getFile: { status: 400, body: { ok: false, description: "Bad Request: file is too big" } } });
    await expect(telegram.download!(f, creds, { id: "x" })).rejects.toThrow(/20 MB/);
  });
});
