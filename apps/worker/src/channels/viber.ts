import { readLimited, safeFetch } from "./net";
import { register } from "./registry";
import { ChannelSendError, type ChannelEvent, type ChannelModule, type InboundItem, type StatusUpdate } from "./types";

/**
 * Viber, through a bot the business already has (decided 2026-11-02): they paste the bot's token. Built from Viber's
 * REST bot API page, read on 2 November 2026. The web route checks X-Viber-Content-Signature and turns the 64-bit
 * `message_token` numbers into strings before parsing, because a JavaScript number cannot hold them exactly.
 *
 *  - A user's first message subscribes them. A bot can message only subscribed users, apart from one welcome message
 *    after `conversation_started`, which has to go out within 5 minutes.
 *  - `send_message` needs `sender.name` (28 characters at most) and answers with a status code; `message_token` is the
 *    message's id, and `delivered`, `seen` and `failed` callbacks refer to it.
 *  - Picture, video and file links last one hour, so the download job runs soon after the message arrives.
 */

const API = "https://chatapi.viber.com/pa";
const MAX_MEDIA = 20 * 1024 * 1024;
const MAX_TEXT = 7000;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** One message callback to a Relay message, or [] for anything that isn't a person writing. */
export function parseViber(body: unknown): InboundItem[] {
  const b = obj(body);
  if (b.event !== "message") return [];
  const sender = obj(b.sender);
  const m = obj(b.message);
  const id = str(sender.id);
  const token = str(b.message_token);
  if (!id || !token) return [];
  const base = {
    kind: "viber",
    address: id,
    ...(str(sender.name) ? { display: str(sender.name)! } : {}),
    externalId: token,
    sentAt: num(b.timestamp) ? new Date(num(b.timestamp)!) : new Date(),
    replyTo: null,
    threadKey: "",
  };
  const text = str(m.text);
  switch (m.type) {
    case "text":
      return text ? [{ ...base, type: "text", body: text, data: {} }] : [];
    case "picture":
    case "video":
    case "file": {
      const url = str(m.media);
      if (!url) return [{ ...base, type: "unsupported", body: null, data: {} }];
      const name = str(m.file_name);
      const mime = m.type === "picture" ? "image/jpeg" : m.type === "video" ? "video/mp4" : undefined;
      return [{
        ...base,
        type: m.type === "picture" ? "image" : m.type === "video" ? "video" : "document",
        body: null,
        // For a picture Viber sends the caption as the text.
        caption: text ?? null,
        data: {},
        media: [{ ref: { id: token, url }, ...(mime ? { mime } : {}), ...(name ? { filename: name } : {}) }],
      }];
    }
    case "location": {
      const loc = obj(m.location);
      const lat = num(loc.lat);
      const lon = num(loc.lon);
      if (lat === undefined || lon === undefined) return [];
      return [{ ...base, type: "location", body: null, data: { latitude: lat, longitude: lon } }];
    }
    default:
      // Stickers, contacts, links and rich media are not shown yet; saying so is better than losing them.
      return [{ ...base, type: "unsupported", body: null, data: {} }];
  }
}

/** Delivered, seen and failed callbacks for messages we sent. */
export function viberStatuses(body: unknown): StatusUpdate[] {
  const b = obj(body);
  const token = str(b.message_token);
  if (!token) return [];
  if (b.event === "delivered") return [{ externalId: token, status: "delivered" }];
  if (b.event === "seen") return [{ externalId: token, status: "read" }];
  if (b.event === "failed") {
    const why = str(b.desc);
    return [{ externalId: token, status: "failed", errorText: `Viber couldn't show this message${why ? `: ${why}` : ""}.` }];
  }
  return [];
}

interface ViberAnswer {
  status?: number;
  status_message?: string;
  message_token?: string;
}

/** Viber's status codes as sentences a person can act on (the code table is on Viber's REST bot API page). */
export function explainViberStatus(status: number, message: string | undefined): ChannelSendError {
  const said = message ? ` Viber says: ${message.slice(0, 200)}` : "";
  switch (status) {
    case 2:
    case 8:
      return new ChannelSendError(`Viber doesn't accept this bot's token. Replace it in Settings > Channels, then send again.${said}`, "bad_credentials");
    case 5:
      return new ChannelSendError("This person is no longer on Viber, so the message can't be delivered.", "not_registered");
    case 6:
      return new ChannelSendError("This person isn't subscribed to your Viber account. Viber lets a bot message someone only after they have written to it.", "not_subscribed");
    case 7:
    case 9:
    case 15:
      return new ChannelSendError(`Viber says this account is blocked, suspended or not authorised, so nothing can be sent.${said}`, `account_${status}`);
    case 11:
      return new ChannelSendError("This person's Viber app is too old to receive messages from accounts like yours.", "no_suitable_device");
    case 12:
      return new ChannelSendError("Viber asked Relay to slow down. It will try again.", "rate_limited", true);
    case 21:
      return new ChannelSendError("Viber doesn't allow this kind of message to this person's country.", "unsupported_country");
    case 23:
    case 24:
      return new ChannelSendError(`Viber won't send more messages on this account: its monthly limit is reached or its balance is empty. Check the account with Viber.${said}`, `billing_${status}`);
    default:
      return new ChannelSendError(`Viber refused the message (code ${status}).${said}`, `status_${status}`);
  }
}

/** Viber's JSON with the 64-bit message_token kept exact: read as text, take the digits, then parse the rest. */
export function readViber(raw: string): ViberAnswer {
  const token = /"message_token"\s*:\s*"?(\d+)"?/.exec(raw)?.[1];
  let parsed: ViberAnswer = {};
  try {
    parsed = JSON.parse(raw.replace(/"message_token"\s*:\s*(\d+)/, '"message_token":"$1"')) as ViberAnswer;
  } catch {
    /* an unreadable answer is handled by the caller */
  }
  return { ...parsed, ...(token ? { message_token: token } : {}) };
}

async function call(f: typeof fetch, token: string, method: string, body: unknown): Promise<{ http: number; answer: ViberAnswer }> {
  let res: Response;
  try {
    res = await f(`${API}/${method}`, {
      method: "POST",
      headers: { "x-viber-auth-token": token, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ChannelSendError("Relay couldn't reach Viber. It will try again.", "unreachable", true);
  }
  return { http: res.status, answer: readViber(await res.text()) };
}

const viber: ChannelModule = {
  type: "viber",
  parse: (body) => parseViber(body),
  statuses: (body) => viberStatuses(body),
  events: (): ChannelEvent[] => [],

  async send(f, creds, req) {
    const name = typeof req.settings.sender_name === "string" && req.settings.sender_name.trim() ? req.settings.sender_name : "Support";
    const { http, answer } = await call(f, creds.auth_token ?? "", "send_message", {
      receiver: req.to,
      min_api_version: 1,
      sender: { name: name.slice(0, 28) },
      type: "text",
      text: req.body.slice(0, MAX_TEXT),
    });
    if (answer.status === 0 && answer.message_token) return { externalId: answer.message_token };
    if (http >= 500) throw new ChannelSendError("Viber had a problem. Relay will try again.", `http_${http}`, true);
    throw explainViberStatus(answer.status ?? -1, answer.status_message);
  },

  /** Viber lets a bot send one welcome message after `conversation_started`, within five minutes. */
  async welcome(f, creds, body, channel) {
    const b = obj(body);
    const text = str(channel.settings.welcome);
    const user = str(obj(b.user).id);
    if (b.event !== "conversation_started" || !text || !user) return;
    // Viber: the event does not subscribe the user, but it allows exactly one message to them.
    const name = typeof channel.settings.sender_name === "string" && channel.settings.sender_name.trim() ? channel.settings.sender_name : "Support";
    const { answer } = await call(f, creds.auth_token ?? "", "send_message", { receiver: user, min_api_version: 1, sender: { name: name.slice(0, 28) }, type: "text", text: text.slice(0, MAX_TEXT) });
    if (answer.status !== 0) throw explainViberStatus(answer.status ?? -1, answer.status_message);
  },

  async download(_f, _creds, ref) {
    // Viber's file links are public and expire after an hour, so no credentials are sent.
    const res = await safeFetch(str(ref.url) ?? "", { timeoutMs: 30_000 });
    if (res.status >= 300 && res.status < 400) throw new Error("Viber sent Relay somewhere else for this file, so it was not followed.");
    if (!res.ok) throw new Error(`Viber wouldn't give the file (${res.status}). Its links expire after an hour.`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_MEDIA) throw new Error("This file is larger than Relay downloads (20 MB).");
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim();
    return { bytes: await readLimited(res, MAX_MEDIA), ...(mime ? { mime } : {}) };
  },
};

register(viber);
export default viber;
