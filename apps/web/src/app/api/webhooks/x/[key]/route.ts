import { handleChannelWebhook, WEBHOOK_KEY, type WebhookChannel } from "@/lib/channels/intake";
import { crcResponse, validXSignature } from "@/lib/channels/x-api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The webhook of a business's own X developer app (decided 2026-11-02). X first checks the address with a GET carrying
 * crc_token (when it is registered, every hour after, and on request) and expects the HMAC of that token under the app's
 * client secret; a failed check stops delivery. Events arrive as POSTs signed with the same secret in
 * X-Twitter-Webhooks-Signature-OAuth2 (the legacy header is not accepted). Like the other channels it only checks, stores
 * and queues; X may repeat an event, which is harmless because each direct message has its own id.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: RouteContext<"/api/webhooks/x/[key]">) {
  const { key } = await ctx.params;
  const crc = new URL(request.url).searchParams.get("crc_token");
  if (!WEBHOOK_KEY.test(key) || !crc) return new Response("Not found", { status: 404 });
  const { data } = await createAdminClient().rpc("channel_for_webhook", { p_type: "x", p_key: key });
  const secret = (data as WebhookChannel[] | null)?.[0]?.secrets.client_secret;
  if (!secret) return new Response("Not found", { status: 404 });
  return Response.json(crcResponse(secret, crc));
}

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/x/[key]">) {
  const { key } = await ctx.params;
  return handleChannelWebhook(request, "x", key, {
    verify: ({ raw, headers, channel }) => validXSignature(channel.secrets.client_secret ?? "", raw, headers.get("x-twitter-webhooks-signature-oauth2")),
    accepted: () => new Response("OK", { status: 200 }),
  });
}
