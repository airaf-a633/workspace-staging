import { handleChannelWebhook } from "@/lib/channels/intake";
import { same } from "@/lib/channels/signatures";

/**
 * Telegram's webhook (decided 2026-11-01). Telegram sends the secret we gave it in the
 * X-Telegram-Bot-Api-Secret-Token header on every call; anything without it is refused. The route only checks,
 * stores and queues. Telegram retries a non-2xx answer an unspecified number of times, which is harmless:
 * each message's id is the dedupe key.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/telegram/[key]">) {
  const { key } = await ctx.params;
  return handleChannelWebhook(request, "telegram", key, {
    verify: ({ headers, channel }) => {
      const sent = headers.get("x-telegram-bot-api-secret-token") ?? "";
      const stored = channel.secrets.secret_token ?? "";
      return !!sent && !!stored && same(sent, stored);
    },
  });
}
