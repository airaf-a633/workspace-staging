import { handleChannelWebhook } from "@/lib/channels/intake";
import { connectorKeys, tokenKid, verifyConnectorToken } from "@/lib/channels/teams-api";

/**
 * The messaging endpoint of a company's Teams bot (decided 2026-11-02). Microsoft signs every call from the Bot
 * Connector with a JWT, checked here the way Microsoft's authentication page says (issuer, audience = this bot's App
 * ID, validity period, signature from Microsoft's published keys, serviceUrl). The random key in the address finds
 * the company's channel. Only messages and conversation updates (someone opening the bot) are queued; typing
 * notices and the like are answered and dropped, as is anything from another company's tenant.
 */
export const dynamic = "force-dynamic";

const QUEUED = new Set(["message", "conversationUpdate"]);

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/teams/[key]">) {
  const { key } = await ctx.params;
  return handleChannelWebhook(request, "teams", key, {
    verify: async ({ raw, headers, channel }) => {
      let activity: { serviceUrl?: unknown; channelId?: unknown };
      try {
        activity = JSON.parse(raw);
      } catch {
        return false;
      }
      const appId = channel.settings.app_id;
      if (typeof appId !== "string" || typeof activity.serviceUrl !== "string" || typeof activity.channelId !== "string") return false;
      const authorization = headers.get("authorization");
      const keys = await connectorKeys(fetch, Date.now(), tokenKid(authorization));
      const verdict = verifyConnectorToken({ authorization, appId, serviceUrl: activity.serviceUrl, channelId: activity.channelId, keys, nowMs: Date.now() });
      if (!verdict.ok) console.warn(`SECURITY: Teams request refused for channel ${channel.id}: ${verdict.reason}`);
      return verdict.ok;
    },
    handshake: (body, { channel }) => {
      const a = (body && typeof body === "object" ? body : {}) as { type?: unknown; channelData?: { tenant?: { id?: unknown } } };
      const ignore = () => new Response(null, { status: 200 });
      if (typeof a.type !== "string" || !QUEUED.has(a.type)) return ignore();
      const expected = channel.settings.tenant_id;
      const tenant = a.channelData?.tenant?.id;
      if (typeof expected === "string" && typeof tenant === "string" && expected.toLowerCase() !== tenant.toLowerCase()) return ignore();
      return null;
    },
    accepted: () => new Response(null, { status: 200 }),
  });
}
