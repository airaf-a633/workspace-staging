import { readLimited } from "./net";
import { register } from "./registry";
import { ChannelSendError, type ChannelModule, type ChannelRow, type Creds, type InboundItem, type Sender } from "./types";

/**
 * Slack, through the one Relay Slack app that each customer adds to their workspace (decided 2026-11-02). Built from
 * Slack's documentation, read on 2 November 2026. A Slack workspace is one Relay channel; each Slack channel the app
 * is in (in practice a Slack Connect channel shared with the customer's company) gives one chat per outside person,
 * with the Slack channel id as the thread key. A message's id is "<channel id>:<ts>", because Slack says `ts` is
 * unique per channel, not across channels.
 *
 * Messages come from the Events API (`event_callback` with a `message` event). People from the customer's company
 * are told apart from the owner's own staff by their workspace (users.info `team_id` against the installed
 * workspace, and `is_stranger`); Slack says no single property confirms it. The owner's staff typing in Slack show in
 * the chat as the team's. Replies go to the thread of the customer's latest message with chat.postMessage.
 */

const API = "https://slack.com/api";
const FILE_HOST = "files.slack.com";
const MAX_MEDIA = 20 * 1024 * 1024;
const MAX_TEXT = 4000;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function kindOf(mime: string | undefined): string {
  if (!mime) return "document";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

/** Slack's `ts` ("1700000000.000200") as a date. */
const tsDate = (ts: string) => new Date(Math.round(Number.parseFloat(ts) * 1000));

/** The subtypes that are a person writing. The rest (joins, pins, edits, deletes, bots) are not filed. */
const WRITTEN = new Set([undefined, "file_share", "thread_broadcast"]);

/** One message event to a Relay message, or [] for anything that isn't a person writing in a channel. */
export function parseSlack(body: unknown, channel: Pick<ChannelRow, "settings">): InboundItem[] {
  const b = obj(body);
  if (b.type !== "event_callback") return [];
  const e = obj(b.event);
  if (e.type !== "message") return [];
  const subtype = str(e.subtype);
  if (!WRITTEN.has(subtype)) return [];
  // Public and private channels only. Direct messages are out of scope (a bot can message an outside person only if they share a channel).
  if (e.channel_type !== "channel" && e.channel_type !== "group") return [];
  const chan = str(e.channel);
  const user = str(e.user);
  const ts = str(e.ts);
  if (!chan || !user || !ts || e.bot_id) return [];
  if (user === channel.settings.bot_user_id) return [];

  const text = str(e.text);
  const files = (Array.isArray(e.files) ? e.files : []).map(obj).flatMap((f) => {
    // A remote file is a link to another site: never fetched with Slack credentials, and not stored.
    const id = str(f.id);
    if (!id || f.is_external === true || f.mode === "external") return [];
    const mime = str(f.mimetype);
    const name = str(f.name);
    return [{
      ref: { id, ...(str(f.url_private) ? { url: str(f.url_private) } : {}), ...(num(f.size) !== undefined ? { size: num(f.size) } : {}) },
      ...(mime ? { mime } : {}),
      ...(name ? { filename: name } : {}),
    }];
  });
  if (!text && !files.length) return [];

  const threadTs = str(e.thread_ts);
  const base = {
    kind: "slack",
    address: user,
    externalId: `${chan}:${ts}`,
    sentAt: tsDate(ts),
    replyTo: threadTs && threadTs !== ts ? `${chan}:${threadTs}` : null,
    threadKey: chan,
    data: { channel: chan, ts, ...(threadTs ? { thread_ts: threadTs } : {}) },
  };
  if (files.length) return [{ ...base, type: kindOf(files[0]!.mime), body: null, caption: text ?? null, media: files }];
  return [{ ...base, type: "text", body: text! }];
}

// ---------------------------------------------------------------------------------------------------------------------
// Slack's Web API

interface SlackAnswer {
  ok?: boolean;
  error?: string;
  [k: string]: unknown;
}

async function call(f: typeof fetch, token: string, method: string, args: Record<string, string>, post: boolean): Promise<{ status: number; body: SlackAnswer }> {
  const query = new URLSearchParams(args).toString();
  let res: Response;
  try {
    res = await f(post ? `${API}/${method}` : `${API}/${method}?${query}`, {
      method: post ? "POST" : "GET",
      headers: { authorization: `Bearer ${token}`, ...(post ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
      ...(post ? { body: query } : {}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ChannelSendError("Relay couldn't reach Slack. It will try again.", "unreachable", true);
  }
  return { status: res.status, body: (await res.json().catch(() => ({}))) as SlackAnswer };
}

const BAD_TOKEN = new Set(["invalid_auth", "not_authed", "token_revoked", "account_inactive", "token_expired", "missing_scope"]);

/** Slack's refusal as a sentence a person can act on. Slack's own error code is kept in the code. */
export function explainSlackError(status: number, error: string | undefined): ChannelSendError {
  const code = error ?? `http_${status}`;
  if (status === 429 || error === "ratelimited" || error === "rate_limited") return new ChannelSendError("Slack asked Relay to slow down. It will try again.", "rate_limited", true);
  if (status >= 500) return new ChannelSendError("Slack had a problem. Relay will try again.", `http_${status}`, true);
  if (error && BAD_TOKEN.has(error)) return new ChannelSendError("Slack no longer accepts Relay's access to this workspace. Add Relay to Slack again in Settings > Channels, then send again.", "bad_credentials");
  if (error === "not_in_channel" || error === "channel_not_found" || error === "no_permission") return new ChannelSendError("Relay's Slack app isn't in this channel any more. Add it to the channel in Slack, then send again.", code);
  if (error === "is_archived") return new ChannelSendError("This Slack channel has been archived, so nothing can be sent to it.", code);
  if (error?.startsWith("restricted_action")) return new ChannelSendError("Slack's settings for this channel don't allow Relay's app to post here.", code);
  if (error?.startsWith("slack_connect_")) return new ChannelSendError("An admin has turned off this kind of sharing in Slack Connect, so Slack refused the message.", code);
  return new ChannelSendError(`Slack refused the message (${code}).`, code);
}

// ---------------------------------------------------------------------------------------------------------------------
// Who wrote it

interface WhoCache {
  at: number;
  who: Sender;
}
const WHO = new Map<string, WhoCache>();
const WHO_TTL = 10 * 60_000;
const WHO_MAX = 5000;

/** Test hook: forget what was learned about people. */
export const forgetPeople = () => WHO.clear();

/**
 * Customer or staff? Asks Slack about the person (users.info) and compares their workspace with the installed one.
 * The answer is kept for ten minutes. A person Slack won't show us is treated as a customer without a name, because
 * hiding an outside person's message is worse than showing it.
 */
export async function whoWrote(f: typeof fetch, creds: Creds, channel: ChannelRow, user: string, now = Date.now()): Promise<Sender> {
  const key = `${channel.id}:${user}`;
  const hit = WHO.get(key);
  if (hit && now - hit.at < WHO_TTL) return hit.who;

  const { status, body } = await call(f, creds.bot_token ?? "", "users.info", { user }, false);
  let who: Sender;
  if (body.ok) {
    const u = obj(body.user);
    const profile = obj(u.profile);
    if (u.is_bot === true) who = { side: "skip" };
    else if (u.is_stranger === true || str(u.team_id) !== channel.settings.team_id) {
      const display = str(profile.display_name) ?? str(u.real_name);
      who = { side: "customer", ...(display ? { display } : {}) };
    } else who = { side: "team" };
  } else if (body.error === "user_not_found" || body.error === "user_not_visible") {
    who = { side: "customer" };
  } else {
    // Rate limited, a bad token, a Slack outage: the queue tries again; nothing is guessed.
    throw explainSlackError(status, body.error);
  }
  if (WHO.size >= WHO_MAX) WHO.clear();
  WHO.set(key, { at: now, who });
  return who;
}

// ---------------------------------------------------------------------------------------------------------------------

const slack: ChannelModule = {
  type: "slack",
  parse: (body, channel) => parseSlack(body, channel),
  sender: (f, creds, item, channel) => whoWrote(f, creds, channel, item.address),

  async send(f, creds, req) {
    const channel = req.threadKey;
    if (!channel) throw new ChannelSendError("This chat has no Slack channel to answer in.", "no_channel");
    // Slack: thread_ts is the parent message's ts, never a reply's.
    const last = req.lastInbound ?? {};
    const parent = str(last.thread_ts) ?? str(last.ts);
    const { status, body } = await call(f, creds.bot_token ?? "", "chat.postMessage", {
      channel,
      text: req.body.slice(0, MAX_TEXT),
      ...(parent ? { thread_ts: parent } : {}),
    }, true);
    const ts = str(body.ts);
    if (body.ok && ts) return { externalId: `${str(body.channel) ?? channel}:${ts}` };
    throw explainSlackError(status, body.error);
  },

  async download(f, creds, ref) {
    const id = str(ref.id);
    if (!id) throw new Error("No file to download.");
    let url = str(ref.url);
    // Slack Connect files may arrive without their address (file_access "check_file_info"): ask Slack for it.
    if (!url) {
      const { body } = await call(f, creds.bot_token ?? "", "files.info", { file: id }, false);
      const file = obj(body.file);
      url = body.ok ? str(file.url_private_download) ?? str(file.url_private) : undefined;
      if (!url) throw new Error("Slack wouldn't tell Relay where this file is.");
    }
    // Slack: confirm https and an exact host before the token goes anywhere, and never follow a redirect with it.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("This file's address isn't valid.");
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== FILE_HOST) throw new Error("This file isn't on Slack, so Relay won't fetch it with Slack's key.");
    let res: Response;
    try {
      res = await f(parsed.toString(), { headers: { authorization: `Bearer ${creds.bot_token ?? ""}` }, redirect: "manual", signal: AbortSignal.timeout(60_000) });
    } catch {
      throw new Error("Relay couldn't reach Slack to download the file.");
    }
    if (res.status >= 300 && res.status < 400) throw new Error("Slack sent Relay somewhere else for this file, so it was not followed.");
    if (!res.ok) throw new Error(`Slack wouldn't give the file (${res.status}).`);
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim();
    // A page of HTML instead of the file means Slack did not accept the key (a sign-in page).
    if (mime === "text/html") throw new Error("Slack answered with a web page instead of the file. Check Relay's access to this workspace.");
    if (Number(res.headers.get("content-length") ?? 0) > MAX_MEDIA) throw new Error("This file is larger than Relay downloads (20 MB).");
    return { bytes: await readLimited(res, MAX_MEDIA), ...(mime ? { mime } : {}) };
  },
};

register(slack);
export default slack;
