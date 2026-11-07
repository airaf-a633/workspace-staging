import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayConnection, type GatewayState, type SocketLike } from "./connection";

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
  ops() { return this.sent.map((p) => p.op); }
}

function setup(over: { random?: () => number } = {}) {
  const sockets: FakeSocket[] = [];
  const states: GatewayState[] = [];
  const dispatched: [string, unknown][] = [];
  const conn = new GatewayConnection({
    token: "tok", url: "wss://gateway.example", intents: 4608,
    socket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; },
    onDispatch: (e, d) => dispatched.push([e, d]),
    onState: (s) => states.push(s),
    random: over.random ?? (() => 0.5),
  });
  return { conn, sockets, states, dispatched };
}
const ready = (s: FakeSocket, extra: Record<string, unknown> = {}) => s.say(0, { session_id: "sess", resume_gateway_url: "wss://resume.example", user: { id: "900" }, application: { id: "800" }, ...extra }, { t: "READY", s: 1 });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("connecting", () => {
  it("opens the address with the API version and encoding", () => {
    const { conn, sockets } = setup();
    conn.start();
    expect(sockets[0]!.url).toBe("wss://gateway.example/?v=10&encoding=json");
  });

  it("identifies with the token and intents after Hello, and reports ready with the bot and application ids", () => {
    const { conn, sockets, states } = setup();
    conn.start();
    sockets[0]!.say(10, { heartbeat_interval: 40_000 });
    expect(sockets[0]!.sent[0]).toEqual({ op: 2, d: { token: "tok", intents: 4608, properties: { os: "linux", browser: "relay", device: "relay" } } });
    ready(sockets[0]!);
    expect(states.at(-1)).toEqual({ kind: "ready", botUserId: "900", applicationId: "800" });
  });

  it("passes other events on, but not Ready", () => {
    const { conn, sockets, dispatched } = setup();
    conn.start();
    sockets[0]!.say(10, { heartbeat_interval: 40_000 });
    ready(sockets[0]!);
    sockets[0]!.say(0, { id: "1" }, { t: "MESSAGE_CREATE", s: 2 });
    expect(dispatched).toEqual([["MESSAGE_CREATE", { id: "1" }]]);
  });
});

describe("heartbeats", () => {
  it("first beats after interval x jitter, then every interval, with the last sequence number", () => {
    const { conn, sockets } = setup();
    conn.start();
    const s = sockets[0]!;
    s.say(10, { heartbeat_interval: 40_000 });
    ready(s);
    s.say(0, {}, { t: "MESSAGE_CREATE", s: 7 });
    vi.advanceTimersByTime(19_999);
    expect(s.ops()).not.toContain(1);
    vi.advanceTimersByTime(1);
    expect(s.sent.filter((p) => p.op === 1)).toEqual([{ op: 1, d: 7 }]);
    s.say(11);
    vi.advanceTimersByTime(40_000);
    expect(s.sent.filter((p) => p.op === 1)).toHaveLength(2);
  });

  it("sends a null sequence before any event", () => {
    const { conn, sockets } = setup();
    conn.start();
    sockets[0]!.say(10, { heartbeat_interval: 1000 });
    vi.advanceTimersByTime(500);
    expect(sockets[0]!.sent.find((p) => p.op === 1)).toEqual({ op: 1, d: null });
  });

  it("answers Discord's request for a heartbeat at once", () => {
    const { conn, sockets } = setup();
    conn.start();
    sockets[0]!.say(10, { heartbeat_interval: 40_000 });
    sockets[0]!.say(1);
    expect(sockets[0]!.ops()).toContain(1);
  });

  it("reconnects with a code that keeps the session when an ACK is missing", () => {
    const { conn, sockets } = setup();
    conn.start();
    const s = sockets[0]!;
    s.say(10, { heartbeat_interval: 10_000 });
    ready(s);
    vi.advanceTimersByTime(5_000); // first beat, never acknowledged
    vi.advanceTimersByTime(10_000); // second beat finds no ACK
    expect(s.closedWith).toBe(4000);
    expect(s.closedWith).not.toBe(1000);
    expect(s.closedWith).not.toBe(1001);
  });
});

describe("resuming", () => {
  it("reconnects to the resume address and resumes with the session and last sequence", () => {
    const { conn, sockets } = setup();
    conn.start();
    sockets[0]!.say(10, { heartbeat_interval: 40_000 });
    ready(sockets[0]!);
    sockets[0]!.say(0, {}, { t: "MESSAGE_CREATE", s: 5 });
    sockets[0]!.say(7); // Discord asks us to reconnect
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    expect(sockets[1]!.url).toBe("wss://resume.example/?v=10&encoding=json");
    sockets[1]!.say(10, { heartbeat_interval: 40_000 });
    expect(sockets[1]!.sent[0]).toEqual({ op: 6, d: { token: "tok", session_id: "sess", seq: 5 } });
    expect(sockets[1]!.ops()).not.toContain(2);
  });

  it("resumes after an invalid session with d true, and identifies again with d false", () => {
    const a = setup();
    a.conn.start();
    a.sockets[0]!.say(10, { heartbeat_interval: 40_000 });
    ready(a.sockets[0]!);
    a.sockets[0]!.say(9, true);
    vi.advanceTimersByTime(1000);
    a.sockets[1]!.say(10, { heartbeat_interval: 40_000 });
    expect(a.sockets[1]!.sent[0]!.op).toBe(6);

    const b = setup();
    b.conn.start();
    b.sockets[0]!.say(10, { heartbeat_interval: 40_000 });
    ready(b.sockets[0]!);
    b.sockets[0]!.say(9, false);
    vi.advanceTimersByTime(1000);
    expect(b.sockets[1]!.url).toBe("wss://gateway.example/?v=10&encoding=json");
    b.sockets[1]!.say(10, { heartbeat_interval: 40_000 });
    expect(b.sockets[1]!.sent[0]!.op).toBe(2);
  });
});

describe("when the connection drops", () => {
  it("waits longer each time, and starts over once Ready arrives", () => {
    const { conn, sockets, states } = setup();
    conn.start();
    sockets[0]!.emit("close", { code: 1006 });
    expect(states.at(-1)).toEqual({ kind: "reconnecting", code: 1006, failures: 1 });
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    sockets[1]!.emit("close", { code: 1006 });
    vi.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
    sockets[2]!.say(10, { heartbeat_interval: 40_000 });
    ready(sockets[2]!);
    sockets[2]!.emit("close", { code: 1006 });
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(4);
  });

  it("slows to every five minutes after five failures in a row", () => {
    const { conn, sockets } = setup();
    conn.start();
    for (let i = 0; i < 5; i++) {
      sockets.at(-1)!.emit("close", { code: 1006 });
      vi.advanceTimersByTime(60_000); // each of the first five waits at most 16 seconds
    }
    expect(sockets).toHaveLength(6);
    sockets.at(-1)!.emit("close", { code: 1006 }); // the sixth failure in a row
    vi.advanceTimersByTime(5 * 60_000 - 1);
    expect(sockets).toHaveLength(6);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(7);
  });

  it.each([[4013, "intents"], [4014, "privileged_intents"]])("stops for good on close %i", (code, reason) => {
    const { conn, sockets, states } = setup();
    conn.start();
    sockets[0]!.emit("close", { code });
    expect(states.at(-1)).toEqual({ kind: "stopped", code, reason });
    vi.advanceTimersByTime(10 * 60_000);
    expect(sockets).toHaveLength(1);
  });
});

describe("stopping", () => {
  it("closes with 1000 and never reconnects", () => {
    const { conn, sockets } = setup();
    conn.start();
    sockets[0]!.say(10, { heartbeat_interval: 40_000 });
    conn.stop();
    expect(sockets[0]!.closedWith).toBe(1000);
    vi.advanceTimersByTime(10 * 60_000);
    expect(sockets).toHaveLength(1);
  });
});

describe("rationing identifies", () => {
  it("refuses to identify more than 100 times a day, so Discord's limit of 1,000 is never near", () => {
    const { conn, sockets } = setup();
    conn.start();
    let identifies = 0;
    for (let i = 0; i < 150; i++) {
      const s = sockets.at(-1)!;
      s.say(10, { heartbeat_interval: 40_000 });
      identifies += s.sent.filter((p) => p.op === 2).length;
      if (s.closedWith === undefined) s.emit("close", { code: 1006 });
      vi.advanceTimersByTime(5 * 60_000);
    }
    expect(identifies).toBe(100);
  });
});
