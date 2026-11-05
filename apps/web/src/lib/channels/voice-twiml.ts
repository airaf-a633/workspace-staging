/**
 * What Relay says back to Twilio when a call arrives (decided 2026-11-02). Written from Twilio's TwiML pages, read
 * on 2 November 2026. Only attributes those pages document are used: Dial (action, method, timeout), Record
 * (action, method, maxLength, timeout, recordingStatusCallback, recordingStatusCallbackMethod) and plain Say.
 *
 * Twilio documents that a Record with no `action` requests the current document again, so every Record here names
 * its own action, which answers with a hangup. Say is read in the default voice and language set in the owner's
 * Twilio Console, which Twilio's pages say is what plays when no voice or language is given.
 */

export const DEFAULT_GREETING = "Sorry, we can't take your call right now. Please leave a message after the beep.";
export const DEFAULT_NOTICE = "This call may be recorded.";
export const MAX_SAY = 300;
export const RING_MIN = 5;
export const RING_MAX = 60;
export const RING_DEFAULT = 20;
/** Twilio's Record default is 3600 s; a voicemail doesn't need an hour. */
export const VOICEMAIL_SECONDS = 120;

export interface VoiceSettings {
  forwardTo?: string | undefined;
  ringSeconds?: number | undefined;
  greeting?: string | undefined;
  notice?: string | undefined;
}

export interface VoiceUrls {
  /** After the forwarded call ends (Dial action). */
  dial: string;
  /** After the caller finishes leaving a message (Record action). */
  done: string;
  /** When the recording file is ready (Record recordingStatusCallback). */
  recording: string;
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const response = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
const say = (text: string) => (text.trim() ? `<Say>${xml(text.trim().slice(0, MAX_SAY))}</Say>` : "");

export const ring = (n: unknown): number => {
  const v = typeof n === "number" ? n : Number.parseInt(String(n ?? ""), 10);
  return Number.isFinite(v) ? Math.min(RING_MAX, Math.max(RING_MIN, Math.round(v))) : RING_DEFAULT;
};

/** The first answer to a call: ring the owner's phone, or (with no phone set) go straight to the voicemail. */
export function incomingTwiml(s: VoiceSettings, urls: VoiceUrls): string {
  if (!s.forwardTo) return voicemailTwiml(s, urls);
  return response(`<Dial timeout="${ring(s.ringSeconds)}" action="${xml(urls.dial)}" method="POST">${xml(s.forwardTo)}</Dial>`);
}

/** The greeting, the recording notice, then the recording. The notice is spoken last, right before the beep. */
export function voicemailTwiml(s: VoiceSettings, urls: VoiceUrls): string {
  return response(
    `${say(s.greeting ?? DEFAULT_GREETING)}${say(s.notice ?? DEFAULT_NOTICE)}` +
      `<Record maxLength="${VOICEMAIL_SECONDS}" timeout="5" action="${xml(urls.done)}" method="POST" recordingStatusCallback="${xml(urls.recording)}" recordingStatusCallbackMethod="POST"/>`,
  );
}

/** After the forwarded call: finished if a person answered, otherwise the voicemail. */
export function afterDialTwiml(dialCallStatus: string | undefined, s: VoiceSettings, urls: VoiceUrls): string {
  return dialCallStatus === "completed" ? hangupTwiml() : voicemailTwiml(s, urls);
}

export const hangupTwiml = () => response("<Hangup/>");

/** The addresses Twilio calls, from Relay's public address and the channel's webhook key. */
export function voiceUrls(origin: string, key: string): VoiceUrls & { incoming: string } {
  const base = `${origin.replace(/\/$/, "")}/api/webhooks/twilio-voice/${key}`;
  return { incoming: base, dial: `${base}/dial`, done: `${base}/done`, recording: `${base}/recording` };
}

/** What the channel's settings JSON holds, read defensively (it is also editable by hand in the database). */
export function voiceSettings(raw: Record<string, unknown>): VoiceSettings {
  const text = (v: unknown) => (typeof v === "string" ? v : undefined);
  const forwardTo = text(raw.forward_to)?.trim();
  const greeting = text(raw.greeting);
  const notice = text(raw.notice);
  return {
    ...(forwardTo ? { forwardTo } : {}),
    ringSeconds: ring(raw.ring_seconds),
    ...(greeting !== undefined ? { greeting } : {}),
    ...(notice !== undefined ? { notice } : {}),
  };
}
