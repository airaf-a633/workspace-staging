import { handleChannelWebhook } from "@/lib/channels/intake";
import { signedBy } from "@/lib/channels/signatures";

/**
 * LINE's webhook (decided 2026-11-01). Every call carries x-line-signature: the base64 HMAC-SHA256 of the raw body
 * under the channel secret. LINE doesn't publish its addresses, so the signature is the only proof. The route only
 * checks, stores and queues; the worker files the messages. The console's Verify button sends an empty `events`
 * list, which is answered 200 and queued as nothing.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/line/[key]">) {
  const { key } = await ctx.params;
  return handleChannelWebhook(request, "line", key, {
    verify: ({ raw, headers, channel }) => signedBy("sha256", channel.secrets.channel_secret ?? "", raw, headers.get("x-line-signature"), "base64"),
    handshake: (body) => {
      const events = (body as { events?: unknown } | null)?.events;
      return Array.isArray(events) && events.length === 0 ? new Response("OK", { status: 200 }) : null;
    },
  });
}
