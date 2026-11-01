import { appOrigin } from "@/lib/app-origin";
import { handleChannelWebhook } from "@/lib/channels/intake";
import { formFields, validTwilioSignature } from "@/lib/channels/twilio";

/**
 * Twilio's delivery reports for texts sent from Relay (decided 2026-11-01): MessageStatus (sent, delivered,
 * undelivered, failed...) and ErrorCode. Twilio says callback fields may change, so the signature check covers
 * whatever fields arrive. The fields are marked as a status report so the worker doesn't file them as a text.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/twilio/[key]/status">) {
  const { key } = await ctx.params;
  const url = `${await appOrigin()}/api/webhooks/twilio/${key}/status${new URL(request.url).search}`;
  return handleChannelWebhook(request, "sms", key, {
    verify: ({ raw, headers, channel }) => validTwilioSignature(channel.secrets.auth_token ?? "", url, formFields(raw), headers.get("x-twilio-signature")),
    parse: (raw) => ({ ...formFields(raw), _relay: "status" }),
    accepted: () => new Response("OK", { status: 200 }),
  });
}
