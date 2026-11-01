import { appOrigin } from "@/lib/app-origin";
import { handleChannelWebhook } from "@/lib/channels/intake";
import { formFields, validTwilioSignature } from "@/lib/channels/twilio";

/**
 * Twilio's webhook for incoming texts (decided 2026-11-01). The signature covers the exact address Twilio was
 * given, so it's rebuilt from Relay's configured public address, never from the proxied request. The form fields
 * are stored as an object; the worker files the text. Twilio expects TwiML back: an empty <Response/> means
 * "don't reply" (the reply is sent from the inbox by a person).
 */
export const dynamic = "force-dynamic";

const emptyTwiml = () => new Response("<Response></Response>", { status: 200, headers: { "content-type": "text/xml" } });

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/twilio/[key]">) {
  const { key } = await ctx.params;
  const url = `${await appOrigin()}/api/webhooks/twilio/${key}${new URL(request.url).search}`;
  return handleChannelWebhook(request, "sms", key, {
    verify: ({ raw, headers, channel }) => validTwilioSignature(channel.secrets.auth_token ?? "", url, formFields(raw), headers.get("x-twilio-signature")),
    parse: formFields,
    accepted: emptyTwiml,
  });
}
