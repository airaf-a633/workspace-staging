import { readLimited, safeFetch } from "./net";
import { register } from "./registry";
import { ChannelSendError, type ChannelModule, type Creds, type InboundItem } from "./types";

/**
 * Microsoft Teams, as an internal help desk (decided 2026-11-02). Each company registers its own Azure Bot and
 * uploads a Teams app that Relay generates; employees chat with the bot one to one. Built from Microsoft's
 * documentation, read on 2 November 2026:
 *  - Teams posts each message to the messaging endpoint as an Activity. The web route has already checked the JWT.
 *  - A personal chat is one flat conversation. Its id is the thread key, and replies are plain sends to it, to the
 *    `serviceUrl` of the employee's latest message (Microsoft says it can change, so it is saved on every message).
 *  - Calls back need a token from the company's own tenant (client credentials, scope https://api.botframework.com/.default).
 *  - A file sent in a personal chat arrives as an attachment of type application/vnd.microsoft.teams.file.download.info
 *    whose content.downloadUrl can be fetched with a plain GET (from an archived Microsoft page).
 */

const MAX_MEDIA = 20 * 1024 * 1024;
const FILE_INFO = "application/vnd.microsoft.teams.file.download.info";
const TOKEN_SCOPE = "https://api.botframework.com/.default";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

/** The words of a message without Teams' mention tags ("<at>Help desk</at>"). */
const plain = (text: string) => text.replace(/<at>.*?<\/at>/gi, "").replace(/\s+/g, " ").trim();

/** Only Teams' own address is trusted for a reply: https, and a Microsoft-run host. */
export function safeServiceUrl(raw: unknown): string | undefined {
  const url = str(raw);
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return undefined;
    return u.toString().endsWith("/") ? u.toString() : `${u.toString()}/`;
  } catch {
    return undefined;
  }
}

/** One message in a personal chat to a Relay message, or [] for anything else (channels, group chats, typing...). */
export function parseTeams(body: unknown, channel: { settings: Record<string, unknown> }): InboundItem[] {
  const a = obj(body);
  if (a.type !== "message") return [];
  const conversation = obj(a.conversation);
  if (conversation.conversationType !== "personal") return [];
  // A single-tenant bot only hears its own company; this makes that sure.
  const tenant = str(obj(obj(a.channelData).tenant).id);
  const expected = str(channel.settings.tenant_id);
  if (expected && tenant && tenant.toLowerCase() !== expected.toLowerCase()) return [];

  const from = obj(a.from);
  const id = str(a.id);
  const conversationId = str(conversation.id);
  const serviceUrl = safeServiceUrl(a.serviceUrl);
  // aadObjectId is the person in the company's directory; it stays the same across bots and chats.
  const address = str(from.aadObjectId) ?? str(from.id);
  if (!id || !conversationId || !address || !serviceUrl || from.role === "bot") return [];

  const text = plain(str(a.text) ?? "");
  const attachments = (Array.isArray(a.attachments) ? a.attachments : []).map(obj);
  const files = attachments.flatMap((att) => {
    if (att.contentType !== FILE_INFO) return [];
    const content = obj(att.content);
    const url = str(content.downloadUrl);
    const unique = str(content.uniqueId) ?? id;
    return url ? [{ ref: { id: unique, url }, ...(str(att.name) ? { filename: str(att.name)! } : {}) }] : [];
  });
  // Anything else attached (a picture pasted in, a card) is not downloadable yet; Teams also repeats a message as html.
  const other = attachments.filter((att) => att.contentType !== FILE_INFO && att.contentType !== "text/html").length;
  if (!text && !files.length && !other) return [];

  const when = Date.parse(str(a.timestamp) ?? "");
  const base = {
    kind: "teams",
    address,
    ...(str(from.name) ? { display: str(from.name)! } : {}),
    // Activity ids are timestamps, so two people can share one: the conversation makes it unique.
    externalId: `${conversationId}|${id}`,
    sentAt: Number.isFinite(when) ? new Date(when) : new Date(),
    replyTo: null,
    threadKey: conversationId,
    data: { conversation_id: conversationId, service_url: serviceUrl, activity_id: id, ...(other ? { other_attachments: other } : {}) },
  };
  if (files.length) return [{ ...base, type: "document", body: null, caption: text || null, media: files }];
  if (!text) return [{ ...base, type: "unsupported", body: null }];
  return [{ ...base, type: "text", body: text }];
}

// ---------------------------------------------------------------------------------------------------------------------

const TOKENS = new Map<string, { token: string; until: number }>();
export const forgetTokens = () => TOKENS.clear();

/** Microsoft's refusal to give a token, in words a person can act on. */
function explainTokenError(status: number, body: { error?: string; error_description?: string }): ChannelSendError {
  const said = body.error_description ? ` Microsoft says: ${body.error_description.split("\r\n")[0]!.slice(0, 250)}` : "";
  if (status >= 500) return new ChannelSendError("Microsoft's sign-in service had a problem. Relay will try again.", `token_${status}`, true);
  return new ChannelSendError(`Microsoft doesn't accept the bot's App ID, secret and tenant. Check them in Settings > Channels. A secret that has expired has to be replaced.${said}`, "bad_credentials");
}

/** A bot token for the Bot Connector: the company's own tenant, client credentials, cached until a minute before it expires. */
export async function botToken(f: typeof fetch, creds: Creds, settings: Record<string, unknown>, now = Date.now()): Promise<string> {
  const appId = str(settings.app_id) ?? "";
  const tenant = str(settings.tenant_id) ?? "";
  const key = `${appId}|${tenant}|${creds.client_secret?.slice(-6) ?? ""}`;
  const hit = TOKENS.get(key);
  if (hit && hit.until > now) return hit.token;
  let res: Response;
  try {
    res = await f(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: appId, client_secret: creds.client_secret ?? "", scope: TOKEN_SCOPE }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ChannelSendError("Relay couldn't reach Microsoft. It will try again.", "unreachable", true);
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw explainTokenError(res.status, body);
  TOKENS.set(key, { token: body.access_token, until: now + Math.max(60, (body.expires_in ?? 3600) - 60) * 1000 });
  return body.access_token;
}

interface ConnectorAnswer {
  id?: string;
  message?: string;
  error?: { code?: string; message?: string };
}

/** Teams' refusal as a sentence a person can act on. */
export function explainTeamsError(status: number, raw: string): ChannelSendError {
  if (status === 429 || status === 412 || status === 502 || status === 504 || status >= 500) {
    return new ChannelSendError("Microsoft Teams is busy. Relay will try again.", `http_${status}`, true);
  }
  if (status === 401) return new ChannelSendError("Microsoft Teams rejected the bot's credentials. Check them in Settings > Channels, then send again.", "bad_credentials");
  if (status === 403) {
    // Microsoft: a user who blocked or uninstalled the bot gets 403 with subCode MessageWritesBlocked.
    if (raw.includes("MessageWritesBlocked")) return new ChannelSendError("This person has blocked or removed the help desk bot, so Teams can't deliver the message.", "blocked");
    return new ChannelSendError("Teams won't let the bot message this person. Check that the Relay help desk app is installed for them.", "forbidden");
  }
  if (status === 404) return new ChannelSendError("Teams can't find this conversation any more.", "conversation_gone");
  return new ChannelSendError(`Microsoft Teams refused the message (${status}).`, `http_${status}`);
}

async function post(f: typeof fetch, token: string, serviceUrl: string, conversationId: string, text: string): Promise<string | undefined> {
  let res: Response;
  try {
    res = await f(`${serviceUrl}v3/conversations/${encodeURIComponent(conversationId)}/activities`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ type: "message", text }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ChannelSendError("Relay couldn't reach Microsoft Teams. It will try again.", "unreachable", true);
  }
  const raw = await res.text();
  if (!res.ok) throw explainTeamsError(res.status, raw);
  try {
    return str((JSON.parse(raw) as ConnectorAnswer).id);
  } catch {
    return undefined;
  }
}

const teams: ChannelModule = {
  type: "teams",
  parse: (body, channel) => parseTeams(body, channel),

  async send(f, creds, req) {
    const last = req.lastInbound ?? {};
    const serviceUrl = safeServiceUrl(last.service_url);
    if (!serviceUrl || !req.threadKey) throw new ChannelSendError("Relay doesn't know where this Teams chat lives yet. Wait for the person to write again.", "no_conversation");
    const token = await botToken(f, creds, req.settings);
    const id = await post(f, token, serviceUrl, req.threadKey, req.body);
    return { externalId: id ?? `sent-${req.messageId}` };
  },

  /** Teams sends "conversationUpdate" with membersAdded when someone first opens the bot. */
  async welcome(f, creds, body, channel) {
    const a = obj(body);
    const greeting = str(channel.settings.greeting);
    if (a.type !== "conversationUpdate" || !greeting) return;
    const conversation = obj(a.conversation);
    if (conversation.conversationType !== "personal") return;
    const botId = str(obj(a.recipient).id);
    const added = (Array.isArray(a.membersAdded) ? a.membersAdded : []).map((m) => str(obj(m).id));
    if (!added.some((id) => id && id !== botId)) return;
    const serviceUrl = safeServiceUrl(a.serviceUrl);
    const conversationId = str(conversation.id);
    if (!serviceUrl || !conversationId) return;
    await post(f, await botToken(f, creds, channel.settings), serviceUrl, conversationId, greeting);
  },

  async download(_f, _creds, ref) {
    // The download address is a pre-authorised OneDrive link: a plain GET, with no Relay credentials sent anywhere.
    const res = await safeFetch(str(ref.url) ?? "", { timeoutMs: 30_000 });
    if (res.status >= 300 && res.status < 400) throw new Error("Teams sent Relay somewhere else for this file, so it was not followed.");
    if (!res.ok) throw new Error(`Teams wouldn't give the file (${res.status}).`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_MEDIA) throw new Error("This file is larger than Relay downloads (20 MB).");
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim();
    return { bytes: await readLimited(res, MAX_MEDIA), ...(mime ? { mime } : {}) };
  },
};

register(teams);
export default teams;
