/**
 * One bot's connection to Discord's Gateway (decided 2026-11-02). Written from Discord's documentation, read on
 * 2 November 2026:
 *  - Discord sends Hello (op 10) with heartbeat_interval. The first heartbeat comes after interval x a random 0..1,
 *    then one per interval, each carrying the last sequence number. A missing ACK (op 11) means the connection is
 *    dead: close with a code other than 1000 or 1001 and reconnect.
 *  - Identify (op 2) sends the token and intents. Ready carries session_id and resume_gateway_url.
 *  - After a drop, Resume (op 6) with token, session_id and the last sequence replays what was missed. Reconnect
 *    (op 7) and Invalid Session with d true mean resume; Invalid Session with d false means identify again.
 *  - Close 4013 (invalid intents) and 4014 (a privileged intent not allowed) will not fix themselves, so they stop.
 *  - Identifying is limited to 1,000 per 24 hours and going over resets the bot's token, so identifies are rationed
 *    far below that. Resuming doesn't count.
 * Discord's pages don't list which other close codes can be resumed, so any other close is retried with backoff.
 */

export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "close", listener: (event: { code: number; reason?: string }) => void): void;
  addEventListener(type: "error", listener: () => void): void;
}
export type SocketFactory = (url: string) => SocketLike;

export type GatewayState =
  | { kind: "connecting" }
  | { kind: "ready"; botUserId: string; applicationId: string | undefined }
  | { kind: "reconnecting"; code: number | undefined; failures: number }
  | { kind: "stopped"; code: number; reason: "intents" | "privileged_intents" };

export interface GatewayOptions {
  token: string;
  /** The address from GET /gateway/bot. */
  url: string;
  intents: number;
  socket: SocketFactory;
  onDispatch: (event: string, data: unknown) => void;
  onState: (state: GatewayState) => void;
  random?: () => number;
  now?: () => number;
}

const API_QUERY = "v=10&encoding=json";
const CLOSE_RECONNECT = 4000; // our own code for "reconnect": anything but 1000 and 1001 keeps the session alive
const MAX_IDENTIFIES_PER_DAY = 100;
const DAY = 24 * 60 * 60 * 1000;

const withQuery = (url: string) => {
  const u = new URL(url);
  u.searchParams.set("v", "10");
  u.searchParams.set("encoding", "json");
  return u.toString();
};

export class GatewayConnection {
  private socket: SocketLike | undefined;
  private seq: number | null = null;
  private sessionId: string | undefined;
  private resumeUrl: string | undefined;
  private acked = true;
  private firstBeat: ReturnType<typeof setTimeout> | undefined;
  private beat: ReturnType<typeof setInterval> | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;
  private stopped = false;
  private identifies: number[] = [];
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(private readonly o: GatewayOptions) {
    this.random = o.random ?? Math.random;
    this.now = o.now ?? Date.now;
  }

  start() {
    this.stopped = false;
    this.connect(withQuery(this.o.url));
  }

  /** Closes for good (1000 ends the session; the bot goes offline). */
  stop() {
    this.stopped = true;
    this.clearTimers();
    if (this.retry) clearTimeout(this.retry);
    this.socket?.close(1000);
    this.socket = undefined;
  }

  private clearTimers() {
    if (this.firstBeat) clearTimeout(this.firstBeat);
    if (this.beat) clearInterval(this.beat);
    this.firstBeat = this.beat = undefined;
  }

  private connect(url: string) {
    this.o.onState(this.failures > 0 ? { kind: "reconnecting", code: undefined, failures: this.failures } : { kind: "connecting" });
    const socket = this.o.socket(url);
    this.socket = socket;
    this.acked = true;
    socket.addEventListener("message", (e) => {
      if (this.socket === socket) this.receive(socket, e.data);
    });
    socket.addEventListener("close", (e) => {
      if (this.socket === socket) this.closed(e.code);
    });
    socket.addEventListener("error", () => {
      /* a close always follows an error */
    });
  }

  private send(socket: SocketLike, op: number, d: unknown) {
    socket.send(JSON.stringify({ op, d }));
  }

  private receive(socket: SocketLike, raw: unknown) {
    let packet: { op?: number; d?: unknown; s?: number | null; t?: string | null };
    try {
      packet = JSON.parse(typeof raw === "string" ? raw : String(raw));
    } catch {
      return;
    }
    if (typeof packet.s === "number") this.seq = packet.s;
    switch (packet.op) {
      case 10: {
        const interval = Number((packet.d as { heartbeat_interval?: number } | undefined)?.heartbeat_interval);
        if (Number.isFinite(interval) && interval > 0) this.startBeating(socket, interval);
        if (this.sessionId) this.send(socket, 6, { token: this.o.token, session_id: this.sessionId, seq: this.seq });
        else this.identify(socket);
        return;
      }
      case 11:
        this.acked = true;
        return;
      case 1:
        this.send(socket, 1, this.seq);
        return;
      case 7:
        socket.close(CLOSE_RECONNECT);
        return;
      case 9:
        if (packet.d !== true) {
          this.sessionId = undefined;
          this.resumeUrl = undefined;
          this.seq = null;
        }
        socket.close(CLOSE_RECONNECT);
        return;
      case 0:
        this.dispatch(packet.t ?? "", packet.d);
        return;
      default:
    }
  }

  private identify(socket: SocketLike) {
    const cutoff = this.now() - DAY;
    this.identifies = this.identifies.filter((t) => t > cutoff);
    if (this.identifies.length >= MAX_IDENTIFIES_PER_DAY) {
      // Far below Discord's limit of 1,000 a day, so a reconnect storm can never get the token reset.
      socket.close(CLOSE_RECONNECT);
      return;
    }
    this.identifies.push(this.now());
    this.send(socket, 2, { token: this.o.token, intents: this.o.intents, properties: { os: "linux", browser: "relay", device: "relay" } });
  }

  private dispatch(event: string, data: unknown) {
    if (event === "READY") {
      const d = (data ?? {}) as { session_id?: string; resume_gateway_url?: string; user?: { id?: string }; application?: { id?: string } };
      this.sessionId = d.session_id;
      this.resumeUrl = d.resume_gateway_url;
      this.failures = 0;
      if (d.user?.id) this.o.onState({ kind: "ready", botUserId: d.user.id, applicationId: d.application?.id });
      return;
    }
    if (event === "RESUMED") {
      this.failures = 0;
      return;
    }
    this.o.onDispatch(event, data);
  }

  private startBeating(socket: SocketLike, interval: number) {
    this.clearTimers();
    const tick = () => {
      if (this.socket !== socket) return;
      if (!this.acked) {
        // No ACK since the last heartbeat: a dead connection. Not 1000 or 1001, so the session survives for a resume.
        socket.close(CLOSE_RECONNECT);
        return;
      }
      this.acked = false;
      this.send(socket, 1, this.seq);
    };
    this.firstBeat = setTimeout(() => {
      tick();
      this.beat = setInterval(tick, interval);
    }, interval * this.random());
  }

  private closed(code: number) {
    this.clearTimers();
    this.socket = undefined;
    if (this.stopped) return;
    if (code === 4013 || code === 4014) {
      this.stopped = true;
      this.o.onState({ kind: "stopped", code, reason: code === 4013 ? "intents" : "privileged_intents" });
      return;
    }
    this.failures++;
    this.o.onState({ kind: "reconnecting", code, failures: this.failures });
    // 1s, 2s, 4s... up to a minute; after five failures in a row, every five minutes.
    const delay = this.failures > 5 ? 5 * 60_000 : Math.min(60_000, 1000 * 2 ** (this.failures - 1));
    this.retry = setTimeout(() => {
      if (this.stopped) return;
      const base = this.sessionId && this.resumeUrl ? this.resumeUrl : this.o.url;
      this.connect(withQuery(base));
    }, delay);
  }
}
