import { readLimited } from "./net";
import { register } from "./registry";
import { ChannelSendError, type ChannelModule, type InboundItem } from "./types";

/**
 * Voice through the customer's own Twilio account (decided 2026-11-02). Built from Twilio's documentation, read on
 * 2 November 2026. Relay answers the call itself with TwiML (the web routes), so this module only files what
 * happened. The routes mark each stored body with `_relay`:
 *   "dial"      the forwarded call ended: DialCallStatus says whether a person answered, DialCallDuration how long
 *   "missed"    voicemail-only inbox: nobody can answer, so every call is a missed call
 *   "recording" the voicemail file is ready (RecordingStatus completed or failed)
 * A call is never replied to in text, so `send` always refuses.
 */

const MAX_MEDIA = 20 * 1024 * 1024;
const RECORDING = /^https:\/\/api\.twilio\.com\/2010-04-01\/Accounts\/AC[A-Za-z0-9]{32}\/Recordings\/RE[A-Za-z0-9]{32}$/;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const digits = (v: string) => v.replace(/\D/g, "");
const seconds = (v: unknown): number | undefined => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** The caller's number as digits, or undefined when Twilio doesn't give a real one (a withheld number). */
function caller(b: Record<string, unknown>): string | undefined {
  const d = digits(str(b.From) ?? "");
  return d.length >= 5 ? d : undefined;
}

/** One call, or one voicemail, to a Relay message. Anything else Twilio sends returns []. */
export function parseVoice(body: unknown): InboundItem[] {
  const b = obj(body);
  const sid = str(b.CallSid);
  const from = caller(b);
  if (!sid || !from) return [];
  const base = { kind: "phone", address: from, sentAt: new Date(), replyTo: null, threadKey: "" };

  if (b._relay === "dial") {
    // Twilio: "completed" means the called party answered and was connected.
    const answered = str(b.DialCallStatus) === "completed";
    const duration = answered ? seconds(b.DialCallDuration) : undefined;
    return [{ ...base, externalId: sid, type: "call", body: null, data: { call: { direction: "in", ...(answered ? {} : { missed: true }), ...(duration !== undefined ? { duration } : {}) } } }];
  }
  if (b._relay === "missed") {
    return [{ ...base, externalId: sid, type: "call", body: null, data: { call: { direction: "in", missed: true } } }];
  }
  if (b._relay === "recording") {
    const recording = str(b.RecordingSid);
    const url = str(b.RecordingUrl);
    if (str(b.RecordingStatus) !== "completed" || !recording || !url) return [];
    const duration = seconds(b.RecordingDuration);
    return [{
      ...base,
      externalId: `vm-${recording}`,
      type: "audio",
      body: null,
      data: { call: { direction: "in", voicemail: true, ...(duration !== undefined ? { duration } : {}) } },
      media: [{ ref: { id: recording, url }, mime: "audio/mpeg" }],
    }];
  }
  return [];
}

const voice: ChannelModule = {
  type: "voice",
  parse: (body) => parseVoice(body),

  async send() {
    throw new ChannelSendError("A phone number can't send text messages. Call the customer back from your own phone.", "voice_no_text");
  },

  async download(f, creds, ref) {
    const url = str(ref.url) ?? "";
    // Credentials are only ever sent to Twilio, and only to a recording address.
    const base = url.replace(/\.(mp3|wav)$/, "");
    if (!RECORDING.test(base)) throw new Error("This recording isn't on Twilio, so Relay won't fetch it.");
    const auth = `Basic ${Buffer.from(`${creds.account_sid ?? ""}:${creds.auth_token ?? ""}`).toString("base64")}`;
    let res: Response;
    try {
      // Twilio: appending .mp3 gives an MP3, the smaller file.
      res = await f(`${base}.mp3`, { headers: { authorization: auth }, signal: AbortSignal.timeout(60_000) });
    } catch {
      throw new Error("Relay couldn't reach Twilio to download the voicemail.");
    }
    if (res.status === 401 || res.status === 403) throw new Error("Twilio wouldn't give the voicemail to this account's credentials. Twilio recommends an API key for recordings.");
    if (!res.ok) throw new Error(`Twilio wouldn't give the voicemail (${res.status}).`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_MEDIA) throw new Error("This voicemail is larger than Relay downloads (20 MB).");
    return { bytes: await readLimited(res, MAX_MEDIA), mime: "audio/mpeg" };
  },
};

register(voice);
export default voice;
