import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serverEnv } from "@/env";
import { appOrigin } from "@/lib/app-origin";
import { slackAuthorizeUrl } from "@/lib/channels/slack-api";
import { can, loadWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
const SLACK_COOKIE = "relay_oauth_slack";

/** Starts "Add to Slack" for a workspace. Only people who manage channels may start it. */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return new NextResponse("Bad request", { status: 400 });
  const origin = await appOrigin();
  const back = (error: string) => NextResponse.redirect(`${origin}/w/${slug}/channels/new/slack?error=${error}`);
  const env = serverEnv();
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET || !env.SLACK_SIGNING_SECRET) return back("notConfigured");

  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return back("notAllowed");

  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(SLACK_COOKIE, JSON.stringify({ state, slug }), {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/api/oauth/slack",
    maxAge: 600,
  });
  return NextResponse.redirect(slackAuthorizeUrl(env.SLACK_CLIENT_ID, `${origin}/api/oauth/slack/callback`, state));
}
