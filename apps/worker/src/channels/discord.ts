import { readLimited, safeFetch } from "./net";
import { register } from "./registry";
import { ChannelSendError, type ChannelModule, type InboundItem } from "./types";

/**
 * Discord, through the customer's own bot (decided 2026-11-02). Built from Discord's documentation, read on
 * 2 November 2026. Discord delivers messages only over the Gateway, so the always-on gateway process (src/gateway)
 * queues each relevant MESSAGE_CREATE as { event, bot_user_id, d } and this module files it.
 *
 * Only what a bot may read without Discord's privileged "Message Content" permission arrives: direct messages to the
 * bot, and server messages that mention it. A direct message is one chat (its channel id is the thread key); a
 * mention in a server channel is one chat per person per channel, answered with a Discord reply under their message.
 */

const API = "https://discord.com/api/v10";
const MAX_MEDIA = 20 * 1024 * 1024;
const MAX_TEXT = 2000;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

function kindOf(mime: string | undefined): string {
  if (!mime) return "document";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

/** A message from a person: type 0 (default) or 19 (reply). Joins, pins, thread starters and the rest are not filed. */
const WRITTEN = new Set([0, 19]);

/** One MESSAGE_CREATE to a Relay message, or [] for anything that isn't a person writing to the bot. */
export function parseDiscord(body: unknown, channel: { settings: Record<string, unknown> }): InboundItem[] {
  const b = obj(body);
  if (b.event !== "MESSAGE_CREATE") return [];
  const d = obj(b.d);
  const bot = str(b.bot_user_id) ?? str(channel.settings.bot_user_id);
  const author = obj(d.author);
  const id = str(d.id);
  const chan = str(d.channel_id);
  const user = str(author.id);
  if (!id || !chan || !user || !WRITTEN.has(Number(d.type ?? 0))) return [];
  if (author.bot === true || user === bot || d.webhook_id) return [];

  // A direct message has no guild. In a server only a mention of the bot is for us.
  const guild = str(d.guild_id);
  const mentions = (Array.isArray(d.mentions) ? d.mentions : []).map((m) => str(obj(m).id));
  if (guild && (!bot || !mentions.includes(bot))) return [];

  // The mention itself ("<@123>" or "<@!123>") is not part of what the customer said.
  const text = (str(d.content) ?? "").replace(bot && /^\d+$/.test(bot) ? new RegExp(`<@!?${bot}>`, "g") : /$^/, "").replace(/[ \t]{2,}/g, " ").trim();
  const files = (Array.isArray(d.attachments) ? d.attachments : []).map(obj).flatMap((a) => {
    const fid = str(a.id);
    const url = str(a.url);
    if (!fid || !url) return [];
    const mime = str(a.content_type);
    const name = str(a.filename);
    return [{ ref: { id: fid, url }, ...(mime ? { mime } : {}), ...(name ? { filename: name } : {}) }];
  });
  if (!text && !files.length) return [];

  const when = Date.parse(str(d.timestamp) ?? "");
  const display = str(author.global_name) ?? str(author.username);
  const reference = str(obj(d.message_reference).message_id);
  const base = {
    kind: "discord",
    address: user,
    ...(display ? { display } : {}),
    externalId: id,
    sentAt: Number.isFinite(when) ? new Date(when) : new Date(),
    replyTo: reference ?? null,
    threadKey: chan,
    data: { channel_id: chan, message_id: id, ...(guild ? { guild_id: guild } : {}) },
  };
  if (files.length) return [{ ...base, type: kindOf(files[0]!.mime), body: null, caption: text || null, media: files }];
  return [{ ...base, type: "text", body: text }];
}

interface DiscordAnswer {
  id?: string;
  message?: string;
  code?: number;
  retry_after?: number;
}

/** Discord's refusal as a sentence a person can act on. Discord's own words are passed on. */
export function explainDiscordError(status: number, body: DiscordAnswer, guild: boolean): ChannelSendError {
  const said = body.message ? ` Discord says: ${body.message.slice(0, 250)}` : "";
  if (status === 429) return new ChannelSendError("Discord asked Relay to slow down. It will try again.", "rate_limited", true);
  if (status >= 500) return new ChannelSendError("Discord had a problem. Relay will try again.", `http_${status}`, true);
  if (status === 401) return new ChannelSendError("Discord rejected this bot's token. Replace it in Settings > Channels, then send again.", "bad_credentials");
  if (status === 403) {
    return new ChannelSendError(
      guild
        ? `Discord won't let the bot post in this channel. Check that it can View Channel, Send Messages and Read Message History there.${said}`
        : `Discord wouldn't deliver this message. The person may have closed their direct messages or blocked the bot.${said}`,
      "forbidden",
    );
  }
  if (status === 404) return new ChannelSendError(`Discord can't find this channel any more.${said}`, "channel_gone");
  return new ChannelSendError(`Discord refused the message (${status}).${said}`, `http_${status}${body.code ? `_${body.code}` : ""}`);
}

const discord: ChannelModule = {
  type: "discord",
  parse: (body, channel) => parseDiscord(body, channel),

  async send(f, creds, req) {
    const channel = req.threadKey;
    if (!channel) throw new ChannelSendError("This chat has no Discord channel to answer in.", "no_channel");
    const last = req.lastInbound ?? {};
    const inServer = typeof last.guild_id === "string";
    const under = typeof last.message_id === "string" ? last.message_id : undefined;
    let res: Response;
    try {
      res = await f(`${API}/channels/${encodeURIComponent(channel)}/messages`, {
        method: "POST",
        headers: {
          authorization: `Bot ${creds.bot_token ?? ""}`,
          "content-type": "application/json",
          // Discord requires "DiscordBot ($url, $versionNumber)" or may block the request.
          "user-agent": `DiscordBot (${req.appUrl ?? "https://relay.invalid"}, 1)`,
        },
        body: JSON.stringify({
          content: req.body.slice(0, MAX_TEXT),
          // A reply under the customer's message in a server; no mentions are ever parsed from an agent's text.
          ...(inServer && under ? { message_reference: { message_id: under, fail_if_not_exists: false } } : {}),
          allowed_mentions: { parse: [] },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ChannelSendError("Relay couldn't reach Discord. It will try again.", "unreachable", true);
    }
    const body = (await res.json().catch(() => ({}))) as DiscordAnswer;
    if (res.ok && body.id) return { externalId: body.id };
    throw explainDiscordError(res.status, body, inServer);
  },

  async download(_f, _creds, ref) {
    // Discord attachment links are public, so no credentials are sent. The address still comes from outside Relay,
    // so it is fetched only if it is a public https address, and a redirect is not followed.
    const url = str(ref.url) ?? "";
    const res = await safeFetch(url, { timeoutMs: 30_000 });
    if (res.status >= 300 && res.status < 400) throw new Error("Discord sent Relay somewhere else for this file, so it was not followed.");
    if (!res.ok) throw new Error(`Discord wouldn't give the file (${res.status}).`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_MEDIA) throw new Error("This file is larger than Relay downloads (20 MB).");
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim();
    return { bytes: await readLimited(res, MAX_MEDIA), ...(mime ? { mime } : {}) };
  },
};

register(discord);
export default discord;
