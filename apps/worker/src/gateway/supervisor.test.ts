import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocketLike } from "./connection";
import { INTENTS, Supervisor } from "./supervisor";

class FakeSocket implements SocketLike {
  sent: { op: number; d: unknown }[] = [];
  closedWith: number | undefined;
  private handlers: Record<string, ((e: never) => void)[]> = {};
  constructor(readonly url: string) {}
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code?: number) { this.closedWith = code; this.emit("close", { code: code ?? 1005 }); }
  addEventListener(type: string, listener: (e: never) => void) { (this.handlers[type] ??= []).push(listener); }
  emit(type: string, event: unknown = {}) { for (const h of this.handlers[type] ?? []) h(event as never); }
  say(op: number, d?: unknown, extra: Record<string, unknown> = {}) { this.emit("message", { data: JSON.stringify({ op, d, ...extra }) }); }
}

function setup(opts: { channels?: string[]; tokens?: Record<string, string>; gateway?: () => Response } = {}) {
  const state = { channels: opts.channels ?? ["ch1"], tokens: opts.tokens ?? { ch1: "tok1" } };
  const calls: { fn: string; args: Record<string, unknown> | undefined }[] = [];
  const sockets: FakeSocket[] = [];
  const logs: string[] = [];
  const asked: { url: string; auth: string; ua: string }[] = [];
  const db = {
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "discord_gateway_channels") return { data: state.channels.map((id) => ({ id })), error: null };
      if (fn === "channel_secrets") return { data: { bot_token: state.tokens[String(args?.p_channel)] }, error: null };
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
  const f = (async (url: string, init: RequestInit) => {
    const h = init.headers as Record<string, string>;
    asked.push({ url, auth: h.authorization!, ua: h["user-agent"]! });
    return opts.gateway ? opts.gateway() : new Response(JSON.stringify({ url: "wss://gw.example", shards: 1 }), { status: 200 });
  }) as unknown as typeof fetch;
  const sup = new Supervisor({ db, fetch: f, socket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; }, log: (m) => logs.push(m), appUrl: "https://relay.example" });
  const health = () => calls.filter((c) => c.fn === "update_channel_runtime").map((c) => [c.args!.p_state, c.args!.p_settings]);
  const queued = () => calls.filter((c) => c.fn === "record_webhook").map((c) => c.args!.p_payload as { channel_id: string; type: string; body: { event: string; bot_user_id: string; d: { id: string } } });
  return { sup, state, calls, sockets, logs, asked, health, queued };
}
const settle = () => vi.advanceTimersByTimeAsync(0);
const ready = async (s: FakeSocket) => {
  s.say(10, { heartbeat_interval: 40_000 });
  s.say(0, { session_id: "sess", resume_gateway_url: "wss://resume.example", user: { id: "900" }, application: { id: "800" } }, { t: "READY", s: 1 });
  await settle();
};
const message = (over: Record<string, unknown> = {}) => ({ id: "m1", channel_id: "D1", type: 0, content: "hi", author: { id: "U1", username: "ana" }, mentions: [], ...over });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("keeping bots online", () => {
  it("connects each connected bot, asking Discord for the address with the bot's token and the required User-Agent", async () => {
    const t = setup();
    await t.sup.sync();
    expect(t.asked).toEqual([{ url: "https://discord.com/api/v10/gateway/bot", auth: "Bot tok1", ua: "DiscordBot (https://relay.example, 1)" }]);
    expect(t.sockets[0]!.url).toBe("wss://gw.example/?v=10&encoding=json");
    t.sockets[0]!.say(10, { heartbeat_interval: 40_000 });
    expect(t.sockets[0]!.sent[0]).toMatchObject({ op: 2, d: { token: "tok1", intents: INTENTS } });
    expect(INTENTS).toBe(512 + 4096);
  });

  it("does not open a second connection on the next pass", async () => {
    const t = setup();
    await t.sup.sync();
    await t.sup.sync();
    expect(t.sockets).toHaveLength(1);
  });

  it("stops a bot that is no longer connected", async () => {
    const t = setup();
    await t.sup.sync();
    t.state.channels = [];
    await t.sup.sync();
    expect(t.sockets[0]!.closedWith).toBe(1000);
  });

  it("restarts a bot whose token was replaced", async () => {
    const t = setup();
    await t.sup.sync();
    t.state.tokens.ch1 = "tok2";
    await t.sup.sync();
    expect(t.sockets[0]!.closedWith).toBe(1000);
    expect(t.sockets).toHaveLength(2);
    expect(t.asked[1]!.auth).toBe("Bot tok2");
  });
});

describe("what the channel page shows", () => {
  it("records ok, with the bot and application ids, once Discord says Ready", async () => {
    const t = setup();
    await t.sup.sync();
    await ready(t.sockets[0]!);
    expect(t.health()).toEqual([["ok", { bot_user_id: "900", application_id: "800" }]]);
  });

  it("records a rejected token and doesn't hammer Discord", async () => {
    const t = setup({ gateway: () => new Response("{}", { status: 401 }) });
    await t.sup.sync();
    expect(t.health()).toEqual([["rejected", {}]]);
    await t.sup.sync();
    expect(t.asked).toHaveLength(1);
    expect(t.sockets).toHaveLength(0);
  });

  it("records trouble reaching Discord and tries again after a minute", async () => {
    let fail = true;
    const t = setup({ gateway: () => { if (fail) throw new Error("offline"); return new Response(JSON.stringify({ url: "wss://gw.example" })); } });
    await t.sup.sync();
    expect(t.health()[0]![0]).toBe("unstable");
    fail = false;
    vi.setSystemTime(Date.now() + 61_000);
    await t.sup.sync();
    expect(t.sockets).toHaveLength(1);
  });

  it.each([[4013, "intents"], [4014, "privileged_intents"]])("records close %i and stays stopped until the token changes", async (code, label) => {
    const t = setup();
    await t.sup.sync();
    t.sockets[0]!.emit("close", { code });
    await settle();
    expect(t.health()).toEqual([[label, {}]]);
    await t.sup.sync();
    expect(t.sockets).toHaveLength(1);
    t.state.tokens.ch1 = "new";
    await t.sup.sync();
    expect(t.sockets).toHaveLength(2);
  });

  it("says so after repeated failures, once", async () => {
    const t = setup();
    await t.sup.sync();
    for (let i = 0; i < 4; i++) {
      t.sockets.at(-1)!.emit("close", { code: 1006 });
      await vi.advanceTimersByTimeAsync(20_000);
    }
    const unstable = t.health().filter(([s]) => s === "unstable");
    expect(unstable).toHaveLength(1);
  });
});

describe("queueing messages", () => {
  async function online() {
    const t = setup();
    await t.sup.sync();
    await ready(t.sockets[0]!);
    return t;
  }
  const send = async (t: Awaited<ReturnType<typeof online>>, d: Record<string, unknown>) => {
    t.sockets[0]!.say(0, d, { t: "MESSAGE_CREATE", s: 2 });
    await settle();
  };

  it("queues a direct message like a webhook, with the bot's id", async () => {
    const t = await online();
    await send(t, message());
    expect(t.queued()).toEqual([{ channel_id: "ch1", type: "discord", body: { event: "MESSAGE_CREATE", bot_user_id: "900", d: message() } }]);
    expect(t.calls.find((c) => c.fn === "record_webhook")!.args).toMatchObject({ p_provider: "channel", p_signature_valid: true });
  });

  it("queues a server message that mentions the bot", async () => {
    const t = await online();
    await send(t, message({ guild_id: "G1", mentions: [{ id: "900" }] }));
    expect(t.queued()).toHaveLength(1);
  });

  it("drops server chatter, other bots, the bot's own messages, webhooks and other events", async () => {
    const t = await online();
    await send(t, message({ guild_id: "G1" }));
    await send(t, message({ guild_id: "G1", mentions: [{ id: "5" }] }));
    await send(t, message({ author: { id: "U2", bot: true } }));
    await send(t, message({ author: { id: "900" } }));
    await send(t, message({ webhook_id: "W1" }));
    t.sockets[0]!.say(0, { id: "x" }, { t: "TYPING_START", s: 3 });
    await settle();
    expect(t.queued()).toEqual([]);
  });

  it("tries again when the database is busy, then gives up with a log line", async () => {
    const t = await online();
    const original = (t.sup as unknown as { d: { db: SupabaseClient } }).d.db.rpc;
    (t.sup as unknown as { d: { db: { rpc: unknown } } }).d.db.rpc = async (fn: string, args?: Record<string, unknown>) => {
      if (fn === "record_webhook") { t.calls.push({ fn, args }); return { data: null, error: { message: "down" } }; }
      return (original as (fn: string, args?: Record<string, unknown>) => unknown)(fn, args);
    };
    await send(t, message());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.calls.filter((c) => c.fn === "record_webhook")).toHaveLength(3);
    expect(t.logs.filter((l) => l.includes("could not queue"))).toHaveLength(3);
  });
});
