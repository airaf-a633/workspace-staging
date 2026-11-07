import { register } from "./registry";
import { ChannelSendError, type ChannelModule, type Creds, type InboundItem, type MediaRef } from "./types";

/**
 * Telegram (decided 2026-11-01). Built from Telegram's own Bot API documentation, read on 1 November 2026:
 * updates arrive by webhook, a message is addressed by the person's numeric chat id, files are fetched with
 * getFile (up to 20 MB for bots), and replies go out with sendMessage (1 to 4096 characters).
 *
 * Decisions: private chats only (groups are ignored); a bare Start press is not filed as a conversation, it
 * only sends the optional greeting; replies are plain text (no parse_mode) so nobody's characters are read as
 * formatting. Facts the documentation doesn't state (the exact error when a person blocked the bot) are
 * matched loosely and fall back to a safe, honest message.
 */

const API = "https://api.telegram.org";
export const MAX_DOWNLOAD = 20 * 1024 * 1024;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** "/start", "/start@bot", "/start airplane": the Start button (or a person typing it). */
export const isStart = (text: string | undefined) => !!text && /^\/start(@\w+)?(\s|$)/i.test(text.trim());

function botIdOf(channel: { settings: Record<string, unknown> }, creds: Creds): string {
  return creds.bot_token?.split(":")[0] ?? String(channel.settings.bot_id ?? "");
}

/** The largest size of a photo (Telegram lists several). */
function bestPhoto(sizes: unknown): Record<string, unknown> | undefined {
  const list = (Array.isArray(sizes) ? sizes : []).map(obj).filter((s) => str(s.file_id));
  return list.sort((a, b) => (num(b.file_size) ?? (num(b.width) ?? 0) * (num(b.height) ?? 0)) - (num(a.file_size) ?? (num(a.width) ?? 0) * (num(a.height) ?? 0)))[0];
}

function file(o: Record<string, unknown>, fallbackMime?: string): MediaRef | undefined {
  const id = str(o.file_id);
  if (!id) return undefined;
  return { ref: { id, file_size: num(o.file_size) ?? null }, mime: str(o.mime_type) ?? fallbackMime, filename: str(o.file_name) };
}

/** One Telegram update to a Relay message. Anything that is not a private-chat message returns []. */
export function parseTelegramUpdate(body: unknown, channel: { settings: Record<string, unknown> }, creds: Creds): InboundItem[] {
  const m = obj(obj(body).message);
  const chat = obj(m.chat);
  const from = obj(m.from);
  const chatId = num(chat.id);
  const messageId = num(m.message_id);
  if (chatId === undefined || messageId === undefined || chat.type !== "private" || from.is_bot === true) return [];
  const text = str(m.text);
  if (isStart(text)) return [];

  const bot = botIdOf(channel, creds);
  const id = (n: number) => `${bot}:${chatId}:${n}`;
  const name = [str(chat.first_name) ?? str(from.first_name), str(chat.last_name) ?? str(from.last_name)].filter(Boolean).join(" ");
  const username = str(chat.username) ?? str(from.username);
  const reply = num(obj(m.reply_to_message).message_id);
  const base = {
    kind: "telegram",
    address: String(chatId),
    display: name || (username ? `@${username}` : undefined),
    externalId: id(messageId),
    sentAt: new Date((num(m.date) ?? Math.floor(Date.now() / 1000)) * 1000),
    replyTo: reply === undefined ? null : id(reply),
    threadKey: "",
  };
  const extra = {
    ...(username ? { username } : {}),
    ...(str(from.language_code) ? { language: str(from.language_code) } : {}),
    ...(str(m.media_group_id) ? { album: str(m.media_group_id) } : {}),
  };
  const caption = str(m.caption) ?? null;
  const withFile = (type: string, media: MediaRef | undefined): InboundItem[] => [
    { ...base, type, body: null, caption, data: extra, ...(media ? { media: [media] } : {}) },
  ];

  if (text) return [{ ...base, type: "text", body: text, data: extra }];
  const photo = bestPhoto(m.photo);
  if (photo) return withFile("image", file(photo, "image/jpeg"));
  if (m.document) return withFile("document", file(obj(m.document)));
  if (m.voice) return withFile("audio", file(obj(m.voice), "audio/ogg"));
  if (m.audio) return withFile("audio", file(obj(m.audio)));
  if (m.video) return withFile("video", file(obj(m.video)));
  if (m.video_note) return withFile("video", file(obj(m.video_note), "video/mp4"));
  if (m.animation) return withFile("video", file(obj(m.animation)));
  if (m.sticker) return [{ ...base, type: "sticker", body: str(obj(m.sticker).emoji) ?? null, data: extra, ...(file(obj(m.sticker)) ? { media: [file(obj(m.sticker))!] } : {}) }];
  if (m.location) {
    const l = obj(m.location);
    return [{ ...base, type: "location", body: null, data: { ...extra, latitude: l.latitude, longitude: l.longitude, name: null, address: null } }];
  }
  if (m.contact) {
    const c = obj(m.contact);
    const shared = [{ name: [str(c.first_name), str(c.last_name)].filter(Boolean).join(" "), phones: [str(c.phone_number)].filter(Boolean) }];
    return [{ ...base, type: "contacts", body: shared[0]!.name || null, data: { ...extra, contacts: shared } }];
  }
  // Anything else (a poll, a game, a payment…) is kept so the team sees that something arrived.
  return [{ ...base, type: "unsupported", body: null, data: { ...extra, original_type: Object.keys(m).find((k) => !["message_id", "date", "chat", "from", "message_thread_id", "is_topic_message"].includes(k)) ?? "unknown" } }];
}

interface TelegramAnswer {
  ok?: boolean;
  description?: string;
  result?: unknown;
  parameters?: { retry_after?: number };
}

async function call(f: typeof fetch, token: string, method: string, payload: Record<string, unknown>): Promise<{ status: number; body: TelegramAnswer }> {
  let res: Response;
  try {
    res = await f(`${API}/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) });
  } catch {
    // The address contains the token, so the underlying error is never passed on.
    throw new ChannelSendError("Relay couldn't reach Telegram. It will try again.", "unreachable", true);
  }
  const body = (await res.json().catch(() => ({}))) as TelegramAnswer;
  return { status: res.status, body };
}

/** Turns Telegram's refusal into a sentence a person can act on. Telegram's own `description` is matched loosely. */
export function explainTelegramError(status: number, body: TelegramAnswer): ChannelSendError {
  const d = (body.description ?? "").toLowerCase();
  if (status === 429 || body.parameters?.retry_after) return new ChannelSendError("Telegram asked Relay to slow down. It will try again.", "rate_limited", true);
  if (status >= 500) return new ChannelSendError("Telegram had a problem. Relay will try again.", `http_${status}`, true);
  if (status === 401) return new ChannelSendError("Telegram rejected this bot's token. Reconnect the bot in Settings > Channels, then send again.", "bad_token");
  if (d.includes("blocked")) return new ChannelSendError("This person blocked the bot, so Relay can't message them.", "blocked");
  if (d.includes("deactivated")) return new ChannelSendError("This Telegram account was deleted, so Relay can't message them.", "deactivated");
  if (d.includes("chat not found")) return new ChannelSendError("Telegram can't find this chat. The person may need to open the bot and press Start.", "no_chat");
  if (status === 403) return new ChannelSendError("Telegram won't let the bot message this person. They may need to open the bot and press Start again.", "forbidden");
  const why = body.description ? ` (${body.description.slice(0, 200)})` : "";
  return new ChannelSendError(`Telegram refused the message${why}.`, `http_${status}`);
}

const telegram: ChannelModule = {
  type: "telegram",
  parse: (body, channel, creds) => parseTelegramUpdate(body, channel, creds),

  async welcome(f, creds, body, _channel) {
    const m = obj(obj(body).message);
    const chat = obj(m.chat);
    const greeting = str(_channel.settings.greeting);
    if (!greeting || chat.type !== "private" || obj(m.from).is_bot === true || !isStart(str(m.text)) || num(chat.id) === undefined) return;
    await call(f, creds.bot_token ?? "", "sendMessage", { chat_id: chat.id, text: greeting.slice(0, 4096) });
  },

  async send(f, creds, req) {
    const { status, body } = await call(f, creds.bot_token ?? "", "sendMessage", { chat_id: Number(req.to), text: req.body.slice(0, 4096) });
    if (status === 200 && body.ok) {
      const sent = num(obj(body.result).message_id);
      return { externalId: `${creds.bot_token?.split(":")[0] ?? ""}:${req.to}:${sent ?? req.messageId}` };
    }
    throw explainTelegramError(status, body);
  },

  async download(f, creds, ref) {
    const fileId = str(ref.id);
    if (!fileId) throw new Error("No file to download.");
    const size = num(ref.file_size);
    if (size !== undefined && size > MAX_DOWNLOAD) throw new Error("This file is over Telegram's 20 MB limit for bots, so Relay can't download it.");
    const { status, body } = await call(f, creds.bot_token ?? "", "getFile", { file_id: fileId });
    const path = str(obj(body.result).file_path);
    if (status !== 200 || !body.ok || !path) {
      throw new Error(body.description?.toLowerCase().includes("too big") ? "This file is over Telegram's 20 MB limit for bots, so Relay can't download it." : `Telegram wouldn't give the file (${status}).`);
    }
    let res: Response;
    try {
      res = await f(`${API}/file/bot${creds.bot_token}/${path}`, { signal: AbortSignal.timeout(60_000) });
    } catch {
      throw new Error("Relay couldn't reach Telegram to download the file.");
    }
    if (!res.ok) throw new Error(`Telegram wouldn't give the file (${res.status}).`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_DOWNLOAD) throw new Error("This file is over Telegram's 20 MB limit for bots, so Relay can't download it.");
    return { bytes, filename: path.split("/").pop() ?? "file" };
  },
};

register(telegram);
export default telegram;
