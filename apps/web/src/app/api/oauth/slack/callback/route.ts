import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serverEnv } from "@/env";
import { appOrigin } from "@/lib/app-origin";
import { exchangeSlackCode } from "@/lib/channels/slack-api";
import { createClient } from "@/lib/supabase/server";
import { can, loadWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Slack sends the person back here. We check the state against our cookie (so nobody can slip their own workspace
 * into someone else's Relay account), swap the code for the workspace's bot token, and hand it to the database,
 * which keeps it in Vault. A workspace that was connected before is reconnected rather than added twice.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = await appOrigin();
  const jar = await cookies();
  const raw = jar.get("relay_oauth_slack")?.value;
  jar.delete({ name: "relay_oauth_slack", path: "/api/oauth/slack" });

  let saved: { state: string; slug: string } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  if (!saved || !/^[a-z0-9-]{2,60}$/.test(saved.slug)) return NextResponse.redirect(`${origin}/app`);
  const slug = saved.slug;
  const back = (error: string) => NextResponse.redirect(`${origin}/w/${slug}/channels/new/slack?error=${error}`);

  if (url.searchParams.get("error")) return back(url.searchParams.get("error") === "access_denied" ? "declined" : "failed");
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== saved.state) return back("failed");
  const env = serverEnv();
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) return back("notConfigured");

  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return back("notAllowed");

  const install = await exchangeSlackCode(fetch, env.SLACK_CLIENT_ID, env.SLACK_CLIENT_SECRET, code, `${origin}/api/oauth/slack/callback`);
  if (!install.ok) return back(install.reason === "unreachable" ? "unreachable" : "failed");
  const { token, botUserId, teamId, teamName } = install.value;

  const supabase = await createClient();
  const settings = { team_id: teamId, team_name: teamName, bot_user_id: botUserId };
  const secrets = { bot_token: token };
  const { data: existing } = await supabase.from("channels").select("id").eq("workspace_id", workspace.id).eq("type", "slack").eq("external_id", teamId).maybeSingle();
  let id: string;
  if (existing) {
    const { error } = await supabase.rpc("update_channel_credentials", { p_channel: existing.id, p_settings: settings, p_secrets: secrets });
    if (error) return back("failed");
    id = existing.id;
  } else {
    const { data: made, error } = await supabase.rpc("connect_channel", { p_workspace: workspace.id, p_type: "slack", p_name: teamName.slice(0, 80), p_external_id: teamId, p_settings: settings, p_secrets: secrets });
    if (error) return back(error.message.includes("already_connected") ? "otherAccount" : error.message.includes("not_allowed") ? "notAllowed" : "failed");
    id = (made as { id: string }).id;
  }
  return NextResponse.redirect(`${origin}/w/${slug}/channels/${id}?created=1`);
}
