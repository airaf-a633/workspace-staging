import "server-only";
import { appOrigin } from "@/lib/app-origin";
import { handleChannelWebhook } from "./intake";
import { formFields, validTwilioSignature } from "./twilio";
import { afterDialTwiml, hangupTwiml, incomingTwiml, voiceSettings, voiceUrls } from "./voice-twiml";

/**
 * The four addresses Twilio calls for a phone number (decided 2026-11-02). Each is signed like every Twilio
 * webhook, over the address Relay gave Twilio (built from the configured public address, never from the proxied
 * request). The call is answered with TwiML straight away; what happened is queued for the worker to file.
 *
 *   incoming   a call arrives. Forwarding set: ring the owner's phone, nothing to file yet.
 *              No phone set: it goes to the voicemail, and since nobody can answer, it is filed as missed.
 *   dial       the forwarded call ended. Answered: hang up. Otherwise take a voicemail. Either way it is filed.
 *   done       the caller finished leaving a message (Record action): hang up. Nothing to file.
 *   recording  the voicemail file is ready: filed with the file.
 */
export type VoiceStep = "incoming" | "dial" | "done" | "recording";
export const VOICE_STEPS: readonly string[] = ["dial", "done", "recording"];

const MARK: Record<VoiceStep, string> = { incoming: "missed", dial: "dial", done: "done", recording: "recording" };
const twiml = (xml: string) => new Response(xml, { status: 200, headers: { "content-type": "text/xml" } });

export async function voiceWebhook(request: Request, key: string, step: VoiceStep): Promise<Response> {
  const urls = voiceUrls(await appOrigin(), key);
  const signed = `${urls[step]}${new URL(request.url).search}`;
  return handleChannelWebhook(request, "voice", key, {
    verify: ({ raw, headers, channel }) => validTwilioSignature(channel.secrets.auth_token ?? "", signed, formFields(raw), headers.get("x-twilio-signature")),
    parse: (raw) => ({ ...formFields(raw), _relay: MARK[step] }),
    handshake: (_body, { channel }) => {
      if (step === "done") return twiml(hangupTwiml());
      if (step === "incoming" && voiceSettings(channel.settings).forwardTo) return twiml(incomingTwiml(voiceSettings(channel.settings), urls));
      return null;
    },
    accepted: ({ raw, channel }) => {
      // A disconnected number answers and hangs up, so the caller isn't left waiting.
      if (channel.status === "disconnected") return twiml(hangupTwiml());
      const settings = voiceSettings(channel.settings);
      if (step === "incoming") return twiml(incomingTwiml(settings, urls));
      if (step === "dial") return twiml(afterDialTwiml(formFields(raw).DialCallStatus, settings, urls));
      return twiml("<Response></Response>");
    },
  });
}
