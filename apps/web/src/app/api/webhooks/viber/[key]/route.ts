import { handleChannelWebhook } from "@/lib/channels/intake";
import { parseViberBody, validViberSignature } from "@/lib/channels/viber-api";

/**
 * Viber's callbacks for a business's own bot (decided 2026-11-02). Each carries X-Viber-Content-Signature, checked with the
 * bot's token. When Relay sets the webhook, Viber first calls the address once to see that it answers 200; that call is
 * allowed without a signature because it changes nothing (it is answered and dropped). The message_token numbers are
 * made strings before parsing so they stay exact.
 */
export const dynamic = "force-dynamic";

const QUEUED = new Set(["message", "conversation_started", "delivered", "seen", "failed"]);

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/viber/[key]">) {
  const { key } = await ctx.params;
  return handleChannelWebhook(request, "viber", key, {
    verify: ({ raw, headers, channel }) => {
      if (validViberSignature(channel.secrets.auth_token ?? "", raw, headers.get("x-viber-content-signature"))) return true;
      try {
        return (JSON.parse(raw) as { event?: unknown }).event === "webhook";
      } catch {
        return false;
      }
    },
    parse: parseViberBody,
    handshake: (body) => {
      const event = (body as { event?: unknown } | null)?.event;
      return typeof event === "string" && QUEUED.has(event) ? null : new Response("OK", { status: 200 });
    },
    accepted: () => new Response("OK", { status: 200 }),
  });
}
