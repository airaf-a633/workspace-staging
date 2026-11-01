import { describe, expect, it } from "vitest";
import { BOT_PERMISSIONS, botFingerprint, checkBotToken, healthOf, inviteUrl } from "./discord-api";

const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("checking a bot token", () => {
  it("asks Discord for the gateway with the bot's token and the required User-Agent", async () => {
    let seen: { url: string; headers: Record<string, string> } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string> };
      return new Response(JSON.stringify({ url: "wss://gateway.discord.gg", shards: 1, session_start_limit: {} }));
    }) as unknown as typeof fetch;
    expect(await checkBotToken(f, "tok", "https://relay.example")).toEqual({ ok: true, value: { shards: 1 } });
    expect(seen!.url).toBe("https://discord.com/api/v10/gateway/bot");
    expect(seen!.headers).toEqual({ authorization: "Bot tok", "user-agent": "DiscordBot (https://relay.example, 1)" });
  });

  it("reports a refused token, an odd answer and an outage", async () => {
    expect(await checkBotToken(reply({ message: "401: Unauthorized" }, 401), "x", "https://r")).toEqual({ ok: false, reason: "rejected" });
    expect(await checkBotToken(reply({}), "x", "https://r")).toEqual({ ok: false, reason: "unreachable" });
    expect(await checkBotToken(reply({}, 500), "x", "https://r")).toEqual({ ok: false, reason: "unreachable" });
    expect(await checkBotToken((async () => { throw new Error("offline"); }) as unknown as typeof fetch, "x", "https://r")).toEqual({ ok: false, reason: "unreachable" });
  });
});

describe("adding the bot to a server", () => {
  it("asks for exactly View Channel, Send Messages and Read Message History", () => {
    expect(BOT_PERMISSIONS).toBe(1024 + 2048 + 65536);
    expect(BOT_PERMISSIONS).toBe(68608);
  });

  it("builds Discord's authorize link for the bot", () => {
    const u = new URL(inviteUrl("800"));
    expect(u.origin + u.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(Object.fromEntries(u.searchParams)).toEqual({ client_id: "800", scope: "bot", permissions: "68608" });
  });
});

describe("one bot, one connection", () => {
  it("fingerprints a token without revealing it, the same way each time", () => {
    const a = botFingerprint("secret-token");
    expect(a).toBe(botFingerprint("secret-token"));
    expect(a).not.toBe(botFingerprint("other-token"));
    expect(a).toMatch(/^tok-[0-9a-f]{32}$/);
    expect(a).not.toContain("secret");
  });
});

describe("reading the Gateway's health", () => {
  it("passes known states and treats anything else as still waiting", () => {
    expect(healthOf({ state: "ok" })).toBe("ok");
    expect(healthOf({ state: "privileged_intents" })).toBe("privileged_intents");
    expect(healthOf(null)).toBe("waiting");
    expect(healthOf({ state: "made-up" })).toBe("waiting");
    expect(healthOf("ok")).toBe("waiting");
  });
});
