import { readLimited } from "./net";
import { register } from "./registry";
import { ChannelSendError, type ChannelEvent, type ChannelModule, type ChannelRow, type InboundItem, type MediaRef } from "./types";

/**
 * LINE (decided 2026-11-01). Built from LINE's own Messaging API documentation, read on 1 November 2026:
 * a webhook carries `destination` and `events[]`; the customer is only a `userId` (their name comes from the
 * profile endpoint); files are fetched from api-data.line.me; a reply token works once and about a minute, and
 * replies made with it are free, while anything later is a push message that counts against the business's own
 * LINE plan. Pushing to someone who blocked the account returns 200 and is never delivered, so a block is only
 * known from the `unfollow` event.
 *
 * Decisions: private chats only; a bare "add friend" is not a conversation (it sends the optional greeting);
 * a block or re-add is written into the chat; replies use the free reply token while it is fresh and push after.
 */

const API = "https://api.line.me";
const DATA = "https://api-data.line.me";
/** LINE says a reply token should be used within about a minute and that this may change, so we stay well inside it. */
const FRESH_MS = 50_000;
export const MAX_DOWNLOAD = 50 * 1024 * 1024;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

interface LineEvent {
  type: string;
  mode?: string;
  timestamp?: number;
  userId: string;
  replyToken?: string;
  eventId?: string;
  raw: Record<string, unknown>;
}

/** The events of a webhook that come from a person in a one-to-one chat, with the account in active mode. */
function privateEvents(body: unknown): LineEvent[] {
  const events = obj(body).events;
  return (Array.isArray(events) ? events : []).flatMap((raw) => {
    const e = obj(raw);
    const source = obj(e.source);
    const userId = str(source.userId);
    if (source.type !== "user" || !userId || e.mode === "standby") return [];
    return [{ type: String(e.type ?? ""), ...(typeof e.mode === "string" ? { mode: e.mode } : {}), ...(num(e.timestamp) !== undefined ? { timestamp: num(e.timestamp)! } : {}), userId, ...(str(e.replyToken) ? { replyToken: str(e.replyToken)! } : {}), ...(str(e.webhookEventId) ? { eventId: str(e.webhookEventId)! } : {}), raw: e }];
  });
}

const botOf = (body: unknown, channel: { settings: Record<string, unknown> }) => str(obj(body).destination) ?? str(channel.settings.bot_user_id) ?? "";

/** Files LINE keeps itself are fetched with the message id; "external" ones are only links and are not downloaded. */
function lineFile(m: Record<string, unknown>, filename?: string, size?: number): MediaRef[] {
  if (obj(m.contentProvider).type === "external") return [];
  const id = str(m.id);
  return id ? [{ ref: { id, file_size: size ?? null }, ...(filename ? { filename } : {}) }] : [];
}

export function parseLineMessages(body: unknown, channel: { settings: Record<string, unknown> }): InboundItem[] {
  const bot = botOf(body, channel);
  return privateEvents(body).flatMap((e): InboundItem[] => {
    if (e.type !== "message") return [];
    const m = obj(e.raw.message);
    const id = str(m.id);
    if (!id) return [];
    const quoted = str(m.quotedMessageId);
    const base = {
      kind: "line",
      address: e.userId,
      externalId: `${bot}:${id}`,
      sentAt: new Date(e.timestamp ?? Date.now()),
      replyTo: quoted ? `${bot}:${quoted}` : null,
      threadKey: "",
    };
    // The reply token and event id are kept on the message: the reply path needs the first, support the second.
    const data = { ...(e.replyToken ? { reply_token: e.replyToken } : {}), ...(e.eventId ? { line_event: e.eventId } : {}) };
    switch (m.type) {
      case "text":
        return [{ ...base, type: "text", body: str(m.text) ?? null, data }];
      case "image": {
        const set = obj(m.imageSet);
        return [{ ...base, type: "image", body: null, caption: null, data: { ...data, ...(str(set.id) ? { image_set: { id: set.id, index: set.index, total: set.total } } : {}) }, media: lineFile(m) }];
      }
      case "video":
        return [{ ...base, type: "video", body: null, data: { ...data, ...(num(m.duration) !== undefined ? { duration_ms: num(m.duration) } : {}) }, media: lineFile(m) }];
      case "audio":
        return [{ ...base, type: "audio", body: null, data: { ...data, ...(num(m.duration) !== undefined ? { duration_ms: num(m.duration) } : {}) }, media: lineFile(m) }];
      case "file":
        return [{ ...base, type: "document", body: null, data, media: lineFile(m, str(m.fileName), num(m.fileSize)) }];
      case "location":
        return [{ ...base, type: "location", body: str(m.title) ?? str(m.address) ?? null, data: { ...data, latitude: m.latitude, longitude: m.longitude, name: str(m.title) ?? null, address: str(m.address) ?? null } }];
      case "sticker":
        // The sticker's picture can't be retrieved from LINE; the team sees that a sticker arrived.
        return [{ ...base, type: "sticker", body: str(m.text) ?? null, data: { ...data, package_id: m.packageId, sticker_id: m.stickerId } }];
      default:
        return [{ ...base, type: "unsupported", body: null, data: { ...data, original_type: str(m.type) ?? "unknown" } }];
    }
  });
}

interface LineAnswer {
  message?: string;
  sentMessages?: { id?: string }[];
}

async function call(f: typeof fetch, token: string, url: string, payload: Record<string, unknown>, headers: Record<string, string> = {}): Promise<{ status: number; body: LineAnswer }> {
  let res: Response;
  try {
    res = await f(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ChannelSendError("Relay couldn't reach LINE. It will try again.", "unreachable", true);
  }
  return { status: res.status, body: (await res.json().catch(() => ({}))) as LineAnswer };
}

/** Turns LINE's refusal into a sentence a person can act on. LINE's own `message` is matched loosely. */
export function explainLineError(status: number, body: LineAnswer): ChannelSendError {
  const said = body.message ? ` LINE says: ${body.message.slice(0, 200)}` : "";
  if (status === 401) return new ChannelSendError("LINE rejected this channel's access token. Reconnect the channel in Settings > Channels, then send again.", "bad_token");
  if (status === 429) {
    if (/monthly/i.test(body.message ?? "")) return new ChannelSendError("This LINE account has used up its monthly message limit, so replies can't be sent until next month or until the plan is upgraded in LINE Official Account Manager.", "monthly_limit");
    return new ChannelSendError("LINE refused the message because a rate limit or this account's monthly message limit was reached. Relay will try again.", "rate_limited", true);
  }
  if (status >= 500) return new ChannelSendError("LINE had a problem. Relay will try again.", `http_${status}`, true);
  return new ChannelSendError(`LINE refused the message (${status}).${said}`, `http_${status}`);
}

const line: ChannelModule = {
  type: "line",
  parse: (body, channel) => parseLineMessages(body, channel),

  events: (body) =>
    privateEvents(body).flatMap((e): ChannelEvent[] => {
      if (e.type === "unfollow") return [{ kind: "blocked", identityKind: "line", address: e.userId }];
      // "isUnblocked" isn't fully reliable (LINE says so); it only adds a small line, never changes who can reply.
      if (e.type === "follow" && obj(e.raw.follow).isUnblocked === true) return [{ kind: "unblocked", identityKind: "line", address: e.userId }];
      return [];
    }),

  async profile(f, creds, userId) {
    const res = await f(`${API}/v2/bot/profile/${encodeURIComponent(userId)}`, { headers: { authorization: `Bearer ${creds.access_token ?? ""}` }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return undefined;
    return str(obj(await res.json().catch(() => ({}))).displayName);
  },

  async welcome(f, creds, body, channel: ChannelRow) {
    const greeting = str(channel.settings.greeting);
    if (!greeting) return;
    for (const e of privateEvents(body)) {
      if (e.type !== "follow" || !e.replyToken) continue;
      const { status, body: answer } = await call(f, creds.access_token ?? "", `${API}/v2/bot/message/reply`, { replyToken: e.replyToken, messages: [{ type: "text", text: greeting.slice(0, 5000) }] });
      if (status !== 200) throw explainLineError(status, answer);
    }
  },

  async send(f, creds, req) {
    const token = creds.access_token ?? "";
    const text = req.body.slice(0, 5000);
    const replyToken = str(req.lastInbound?.reply_token);
    // A reply with a fresh token is free. Used-up or stale tokens are expected, so that case falls through to a push.
    if (replyToken && req.lastInboundAt && Date.now() - req.lastInboundAt.getTime() < FRESH_MS) {
      const r = await call(f, token, `${API}/v2/bot/message/reply`, { replyToken, messages: [{ type: "text", text }] });
      if (r.status === 200) return { externalId: `line-reply:${req.messageId}` };
      if (!(r.status === 400 && /reply token/i.test(r.body.message ?? ""))) throw explainLineError(r.status, r.body);
    }
    // The message id is the retry key, so a retried send can never reach the customer twice (a repeat answers 409).
    const p = await call(f, token, `${API}/v2/bot/message/push`, { to: req.to, messages: [{ type: "text", text }] }, { "X-Line-Retry-Key": req.messageId });
    if (p.status === 200) return { externalId: str(p.body.sentMessages?.[0]?.id) ?? `line-push:${req.messageId}` };
    if (p.status === 409) return { externalId: `line-push:${req.messageId}` };
    throw explainLineError(p.status, p.body);
  },

  async download(f, creds, ref) {
    const id = str(ref.id);
    if (!id) throw new Error("No file to download.");
    const size = num(ref.file_size);
    if (size !== undefined && size > MAX_DOWNLOAD) throw new Error("This file is larger than Relay downloads (50 MB).");
    let res: Response;
    try {
      res = await f(`${DATA}/v2/bot/message/${encodeURIComponent(id)}/content`, { headers: { authorization: `Bearer ${creds.access_token ?? ""}` }, signal: AbortSignal.timeout(60_000) });
    } catch {
      throw new Error("Relay couldn't reach LINE to download the file.");
    }
    if (res.status === 202) throw new Error("LINE is still preparing this file. Relay will try again.");
    if (res.status === 404 || res.status === 410) throw new Error("LINE no longer has this file. LINE deletes files a while after they are sent.");
    if (!res.ok) throw new Error(`LINE wouldn't give the file (${res.status}).`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_DOWNLOAD) throw new Error("This file is larger than Relay downloads (50 MB).");
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim();
    return { bytes: await readLimited(res, MAX_DOWNLOAD), ...(mime ? { mime } : {}) };
  },
};

register(line);
export default line;
