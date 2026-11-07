import { VOICE_STEPS, voiceWebhook, type VoiceStep } from "@/lib/channels/voice-intake";

/** The follow-up calls Twilio makes while a call is handled: dial, done, recording. See voice-intake.ts. */
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/twilio-voice/[key]/[step]">) {
  const { key, step } = await ctx.params;
  if (!VOICE_STEPS.includes(step)) return new Response("Not found", { status: 404 });
  return voiceWebhook(request, key, step as VoiceStep);
}
