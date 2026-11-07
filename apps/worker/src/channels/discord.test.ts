import { describe, expect, it } from "vitest";
import discord, { explainDiscordError, parseDiscord } from "./discord";
import { ChannelSendError } from "./types";

const channel = { settings: { bot_user_id: "900" } };
const create = (d: Record<string, unknown> = {}, bot = "900") => ({
  event: "MESSAGE_CREATE",
  bot_user_id: bot,
  d: { id: "111", channel_id: "C1", type: 0, content: "Hello", timestamp: "2026-11-02T10:00:00.000000+00:00", author: { id: "U1", username: "ana", global_name: "Ana Ruiz" }, mentions: [], attachments: [], ...d },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("reading a Discord message", () => {
  it("files a direct message as a chat per Discord channel", () => {
    const [m] = parseDiscord(create(), channel);
    expect(m).toMatchObject({ kind: "discord", address: "U1", display: "Ana Ruiz", externalId: "111", type: "text", body: "Hello", threadKey: "C1", replyTo: null, data: { channel_id: "C1", message_id: "111" } });
    expect(m!.sentAt.toISOString()).toBe("2026-11-02T10:00:00.000Z");
    expect((m!.data as Record<string, unknown>).guild_id).toBeUndefined();
  });

  it("falls back to the username when there is no display name", () => {
    expect(parseDiscord(create({ author: { id: "U1", username: "ana", global_name: null } }), channel)[0]!.display).toBe("ana");
  });

  it("files a server message only when it mentions the bot, and removes the mention", () => {
    const [m] = parseDiscord(create({ guild_id: "G1", content: "<@900> where is my order?", mentions: [{ id: "900" }] }), channel);
    expect(m).toMatchObject({ body: "where is my order?", data: { guild_id: "G1", message_id: "111" } });
    expect(parseDiscord(create({ guild_id: "G1", content: "<@!900>   hi   there", mentions: [{ id: "900" }] }), channel)[0]!.body).toBe("hi there");
  });

  it("ignores server chatter that doesn't mention the bot, or mentions someone else", () => {
    expect(parseDiscord(create({ guild_id: "G1", content: "lunch?" }), channel)).toEqual([]);
    expect(parseDiscord(create({ guild_id: "G1", content: "<@5> lunch?", mentions: [{ id: "5" }] }), channel)).toEqual([]);
  });

  it("uses the bot id the gateway saw, and the settings as a fallback", () => {
    expect(parseDiscord(create({ guild_id: "G1", content: "<@777> hi", mentions: [{ id: "777" }] }, "777"), { settings: {} })).toHaveLength(1);
    expect(parseDiscord({ ...create({ guild_id: "G1", content: "<@900> hi", mentions: [{ id: "900" }] }), bot_user_id: undefined }, channel)).toHaveLength(1);
  });

  it("points a reply at the message it answers", () => {
    expect(parseDiscord(create({ type: 19, message_reference: { message_id: "99" } }), channel)[0]!.replyTo).toBe("99");
  });

  it("maps attachments, keeping the words as the caption", () => {
    const [m] = parseDiscord(create({ content: "My receipt", attachments: [{ id: "A1", filename: "r.png", content_type: "image/png", size: 5, url: "https://cdn.example/r.png" }, { id: "A2", filename: "b.pdf", url: "https://cdn.example/b.pdf" }] }), channel);
    expect(m).toMatchObject({ type: "image", body: null, caption: "My receipt" });
    expect(m!.media).toHaveLength(2);
    expect(m!.media![0]).toMatchObject({ ref: { id: "A1", url: "https://cdn.example/r.png" }, mime: "image/png", filename: "r.png" });
  });

  it("files a picture with no words", () => {
    expect(parseDiscord(create({ content: "", attachments: [{ id: "A1", filename: "r.png", content_type: "image/png", url: "https://cdn.example/r.png" }] }), channel)[0]).toMatchObject({ type: "image", caption: null });
  });

  it.each([
    ["a bot", { author: { id: "U2", bot: true } }],
    ["the bot itself", { author: { id: "900" } }],
    ["a webhook", { webhook_id: "W1" }],
    ["a system message", { type: 7 }],
    ["a thread starter", { type: 21 }],
    ["an empty message", { content: "" }],
    ["no author", { author: undefined }],
  ])("skips %s", (_n, over) => {
    expect(parseDiscord(create(over), channel)).toEqual([]);
  });

  it("skips other events and junk", () => {
    expect(parseDiscord({ event: "MESSAGE_UPDATE", d: {} }, channel)).toEqual([]);
    expect(parseDiscord(null, channel)).toEqual([]);
  });
});

describe("sending", () => {
  const creds = { bot_token: "tok" };
  const req = (over: Record<string, unknown> = {}) => ({ messageId: "m", body: "On it!", to: "U1", threadKey: "C1", settings: {}, appUrl: "https://relay.example", lastInbound: { channel_id: "C1", message_id: "111" }, lastInboundAt: new Date(), ...over });

  it("posts into the channel with the bot's token and the required User-Agent", async () => {
    let seen: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
      return json({ id: "222" });
    }) as unknown as typeof fetch;
    expect(await discord.send(f, creds, req())).toEqual({ externalId: "222" });
    expect(seen!.url).toBe("https://discord.com/api/v10/channels/C1/messages");
    expect(seen!.headers.authorization).toBe("Bot tok");
    expect(seen!.headers["user-agent"]).toBe("DiscordBot (https://relay.example, 1)");
    expect(seen!.body).toEqual({ content: "On it!", allowed_mentions: { parse: [] } });
  });

  it("replies under the customer's message in a server, without failing if it was deleted", async () => {
    let body!: Record<string, unknown>;
    const f = (async (_u: string, init: RequestInit) => { body = JSON.parse(String(init.body)); return json({ id: "3" }); }) as unknown as typeof fetch;
    await discord.send(f, creds, req({ lastInbound: { channel_id: "C1", message_id: "111", guild_id: "G1" } }));
    expect(body.message_reference).toEqual({ message_id: "111", fail_if_not_exists: false });
  });

  it("cuts a message at 2,000 characters", async () => {
    let body!: Record<string, unknown>;
    const f = (async (_u: string, init: RequestInit) => { body = JSON.parse(String(init.body)); return json({ id: "3" }); }) as unknown as typeof fetch;
    await discord.send(f, creds, req({ body: "a".repeat(3000) }));
    expect((body.content as string).length).toBe(2000);
  });

  it("refuses without a channel, and retries when Discord can't be reached", async () => {
    await expect(discord.send(fetch, creds, req({ threadKey: "" }))).rejects.toBeInstanceOf(ChannelSendError);
    await expect(discord.send((async () => { throw new Error("offline"); }) as unknown as typeof fetch, creds, req())).rejects.toMatchObject({ temporary: true });
  });

  it("explains Discord's refusals in plain words", async () => {
    const refuse = (status: number, body: Record<string, unknown> = {}) => (async () => json(body, status)) as unknown as typeof fetch;
    await expect(discord.send(refuse(401), creds, req())).rejects.toMatchObject({ code: "bad_credentials" });
    await expect(discord.send(refuse(403, { message: "Missing Access", code: 50001 }), creds, req({ lastInbound: { guild_id: "G1", message_id: "1" } }))).rejects.toMatchObject({ message: expect.stringContaining("Send Messages and Read Message History") });
    await expect(discord.send(refuse(403, { message: "Cannot send messages to this user", code: 50007 }), creds, req())).rejects.toMatchObject({ message: expect.stringMatching(/closed their direct messages or blocked.*Cannot send messages to this user/) });
    await expect(discord.send(refuse(404), creds, req())).rejects.toMatchObject({ code: "channel_gone" });
    await expect(discord.send(refuse(429, { retry_after: 1.2 }), creds, req())).rejects.toMatchObject({ temporary: true });
    await expect(discord.send(refuse(502), creds, req())).rejects.toMatchObject({ temporary: true });
  });

  it("says what Discord said for an error it doesn't know", () => {
    expect(explainDiscordError(400, { message: "Invalid Form Body", code: 50035 }, false)).toMatchObject({ code: "http_400_50035", message: "Discord refused the message (400). Discord says: Invalid Form Body" });
  });
});

describe("downloading a file", () => {
  it("never fetches a private or non-https address", async () => {
    for (const url of ["http://cdn.example/x", "https://127.0.0.1/x", "https://169.254.169.254/latest", "not a url", ""]) {
      await expect(discord.download!(fetch, {}, { id: "A1", url })).rejects.toThrow();
    }
  });
});
