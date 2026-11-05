import { voiceWebhook } from "@/lib/channels/voice-intake";

/** A call arrives at a Twilio number connected as a phone line (decided 2026-11-02). See voice-intake.ts. */
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/twilio-voice/[key]">) {
  const { key } = await ctx.params;
  return voiceWebhook(request, key, "incoming");
}
