import { readLimited } from "./net";
import { register } from "./registry";
import { ChannelSendError, type ChannelEvent, type ChannelModule, type InboundItem, type StatusUpdate } from "./types";

/**
 * SMS through the customer's own Twilio account (decided 2026-11-01). Built from Twilio's documentation, read on
 * 1 November 2026: a text arrives as form fields (`MessageSid`, `From`, `Body`, `NumMedia`, `MediaUrl{N}`...);
 * a reply is `POST /2010-04-01/Accounts/{sid}/Messages.json` (up to 1,600 characters) with a `StatusCallback`;
 * Twilio reports delivery as `MessageStatus`/`ErrorCode`, and a customer's STOP as `OptOutType=STOP`.
 *
 * The web route rebuilds the exact address, checks Twilio's signature and stores the form fields as an object.
 * Delivery callbacks are marked `_relay: "status"` by their own route.
 */

const API = "https://api.twilio.com";
const MAX_MEDIA = 20 * 1024 * 1024;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const digits = (v: string) => v.replace(/\D/g, "");

const isStatus = (b: Record<string, unknown>) => b._relay === "status";

function kindOf(mime: string | undefined): string {
  if (!mime) return "document";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

/** One incoming text (or picture message) to a Relay message. Delivery callbacks and empty texts return []. */
export function parseSmsMessage(body: unknown): InboundItem[] {
  const b = obj(body);
  if (isStatus(b)) return [];
  const sid = str(b.MessageSid) ?? str(b.SmsSid);
  const from = digits(str(b.From) ?? "");
  if (!sid || from.length < 5) return [];
  const text = str(b.Body);
  const count = Math.min(Number.parseInt(String(b.NumMedia ?? "0"), 10) || 0, 10);
  const media = Array.from({ length: count }, (_, i) => ({ url: str(b[`MediaUrl${i}`]), mime: str(b[`MediaContentType${i}`]) }))
    .flatMap((m, i) => (m.url ? [{ ref: { id: `${sid}-${i}`, url: m.url }, ...(m.mime ? { mime: m.mime } : {}) }] : []));
  if (!text && !media.length) return [];
  const base = { kind: "phone", address: from, externalId: sid, sentAt: new Date(), replyTo: null, threadKey: "" };
  if (media.length) return [{ ...base, type: kindOf(media[0]!.mime), body: null, caption: text ?? null, data: media.length > 1 ? { more_files: media.length - 1 } : {}, media }];
  return [{ ...base, type: "text", body: text!, data: {} }];
}

/** Twilio's own report of a customer's STOP or START. HELP is only filed as a message. */
export function smsEvents(body: unknown): ChannelEvent[] {
  const b = obj(body);
  const from = digits(str(b.From) ?? "");
  const type = str(b.OptOutType)?.toUpperCase();
  if (isStatus(b) || from.length < 5) return [];
  if (type === "STOP") return [{ kind: "opted_out", identityKind: "phone", address: from }];
  if (type === "START") return [{ kind: "opted_in", identityKind: "phone", address: from }];
  return [];
}

const BLOCKED = "This person replied STOP, so Twilio blocks texts to them until they text START.";

/** Delivery reports for texts we sent. Twilio says error codes may change, so the code is shown but never relied on. */
export function smsStatuses(body: unknown): StatusUpdate[] {
  const b = obj(body);
  const sid = str(b.MessageSid) ?? str(b.SmsSid);
  const status = str(b.MessageStatus ?? b.SmsStatus);
  if (!isStatus(b) || !sid || !status) return [];
  if (status === "sent" || status === "delivered" || status === "read") return [{ externalId: sid, status }];
  if (status === "failed" || status === "undelivered") {
    const code = str(b.ErrorCode);
    return [{ externalId: sid, status: "failed", ...(code ? { errorCode: code } : {}), errorText: code === "21610" ? BLOCKED : `The text wasn't delivered${code ? ` (Twilio error ${code})` : ""}.` }];
  }
  return []; // queued, sending, accepted...: not a change worth showing
}

interface TwilioAnswer {
  sid?: string;
  code?: number;
  message?: string;
}

/** Turns Twilio's refusal into a sentence a person can act on. Twilio's own `message` is passed on. */
export function explainTwilioError(status: number, body: TwilioAnswer): ChannelSendError {
  const said = body.message ? ` Twilio says: ${body.message.slice(0, 250)}` : "";
  if (body.code === 21610) return new ChannelSendError(BLOCKED, "stopped");
  if (status === 401) return new ChannelSendError("Twilio rejected this account's credentials. Reconnect the channel in Settings > Channels, then send again.", "bad_credentials");
  if (status === 429) return new ChannelSendError("Twilio asked Relay to slow down. It will try again.", "rate_limited", true);
  if (status >= 500) return new ChannelSendError("Twilio had a problem. Relay will try again.", `http_${status}`, true);
  return new ChannelSendError(`Twilio refused the text (${status}).${said}`, `http_${status}${body.code ? `_${body.code}` : ""}`);
}

const basic = (sid: string, token: string) => `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;

const sms: ChannelModule = {
  type: "sms",
  parse: (body) => parseSmsMessage(body),
  events: (body) => smsEvents(body),
  statuses: (body) => smsStatuses(body),

  async send(f, creds, req) {
    const sid = creds.account_sid ?? "";
    const number = typeof req.settings.number === "string" ? req.settings.number : "";
    if (!number) throw new ChannelSendError("This SMS inbox has no sending number. Reconnect it in Settings > Channels.", "no_number");
    const key = typeof req.settings.webhook_key === "string" ? req.settings.webhook_key : "";
    const form = new URLSearchParams({ To: `+${digits(req.to)}`, From: number, Body: req.body.slice(0, 1600) });
    // Twilio reports delivery back to Relay, so the thread can show delivered and failed.
    if (req.appUrl && key) form.set("StatusCallback", `${req.appUrl.replace(/\/$/, "")}/api/webhooks/twilio/${key}/status`);
    let res: Response;
    try {
      res = await f(`${API}/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: "POST",
        headers: { authorization: basic(sid, creds.auth_token ?? ""), "content-type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ChannelSendError("Relay couldn't reach Twilio. It will try again.", "unreachable", true);
    }
    const body = (await res.json().catch(() => ({}))) as TwilioAnswer;
    if (res.ok && body.sid) return { externalId: body.sid };
    throw explainTwilioError(res.status, body);
  },

  async download(f, creds, ref) {
    const url = str(ref.url) ?? "";
    // Credentials are only ever sent to Twilio.
    if (!/^https:\/\/api\.twilio\.com\//.test(url)) throw new Error("This picture isn't on Twilio, so Relay won't fetch it.");
    let res: Response;
    try {
      res = await f(url, { headers: { authorization: basic(creds.account_sid ?? "", creds.auth_token ?? "") }, signal: AbortSignal.timeout(60_000) });
    } catch {
      throw new Error("Relay couldn't reach Twilio to download the file.");
    }
    if (!res.ok) throw new Error(`Twilio wouldn't give the file (${res.status}).`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_MEDIA) throw new Error("This file is larger than Relay downloads (20 MB).");
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim();
    return { bytes: await readLimited(res, MAX_MEDIA), ...(mime ? { mime } : {}) };
  },
};

register(sms);
export default sms;
