import { handleSlackEvent } from "@/lib/channels/slack-intake";

/** Slack's events for every workspace that added Relay (decided 2026-11-02). See slack-intake.ts. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleSlackEvent(request);
}
