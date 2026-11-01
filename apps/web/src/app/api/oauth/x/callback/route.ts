import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { appOrigin } from "@/lib/app-origin";
import { exchangeXCode, getMe, registerWebhook, subscribeToDms } from "@/lib/channels/x-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, loadWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * X sends the person back here with a one-time code (good for 30 seconds). We check the state against our cookie, swap the
 * code for the account's tokens using the business's own app, find out which account it is, make sure the webhook is
 * registered with the app's bearer token, and subscribe the account to direct messages it receives. The tokens go to the
 * database, which keeps them in Vault; they are never put in an address.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = await appOrigin();
  const jar = await cookies();
  const raw = jar.get("relay_oauth_x")?.value;
  jar.delete({ name: "relay_oauth_x", path: "/api/oauth/x" });

  let saved: { state: string; verifier: string; slug: string; id: string } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  if (!saved || !/^[a-z0-9-]{2,60}$/.test(saved.slug) || !z.uuid().safeParse(saved.id).success) return NextResponse.redirect(`${origin}/app`);
  const { slug, id } = saved;
  const back = (error: string) => NextResponse.redirect(`${origin}/w/${slug}/channels/${id}?error=${error}`);

  if (url.searchParams.get("error")) return back(url.searchParams.get("error") === "access_denied" ? "xDeclined" : "xFailed");
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== saved.state) return back("xFailed");

  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return back("notAllowed");
  // The admin client sees every workspace, so first prove this channel is in the person's own workspace.
  const { data: ch } = await supabase.from("channels").select("id, settings").eq("id", id).eq("workspace_id", workspace.id).eq("type", "x").maybeSingle();
  const s = (ch?.settings ?? {}) as { client_id?: string; webhook_key?: string; webhook_id?: string };
  if (!ch || !s.client_id || !s.webhook_key) return back("xFailed");
  const { data: secrets } = await createAdminClient().rpc("channel_secrets", { p_channel: id });
  const creds = (secrets ?? {}) as { client_secret?: string; bearer_token?: string };
  if (!creds.client_secret || !creds.bearer_token) return back("xFailed");

  const tokens = await exchangeXCode(fetch, s.client_id, creds.client_secret, code, `${origin}/api/oauth/x/callback`, saved.verifier);
  if (!tokens.ok) return back(tokens.reason === "unreachable" ? "xUnreachable" : "xFailed");
  const me = await getMe(fetch, tokens.value.accessToken);
  if (!me.ok) return back(me.reason === "unreachable" ? "xUnreachable" : "xFailed");

  // Save the login first, so a later step failing never throws it away.
  const { error: saveError } = await supabase.rpc("update_channel_credentials", {
    p_channel: id,
    p_settings: { user_id: me.value.id, ...(me.value.username ? { username: me.value.username } : {}) },
    p_secrets: { access_token: tokens.value.accessToken, expires_at: String(tokens.value.expiresAt), ...(tokens.value.refreshToken ? { refresh_token: tokens.value.refreshToken } : {}) },
  });
  if (saveError) return back("xFailed");

  let webhookId = s.webhook_id;
  if (!webhookId) {
    const hook = await registerWebhook(fetch, creds.bearer_token, `${origin}/api/webhooks/x/${s.webhook_key}`);
    if (!hook.ok) return back(hook.reason === "unreachable" ? "xUnreachable" : "xWebhook");
    webhookId = hook.value.id;
    await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: { webhook_id: webhookId }, p_secrets: {} });
  }
  const sub = await subscribeToDms(fetch, tokens.value.accessToken, me.value.id, webhookId);
  if (!sub.ok) return back(sub.reason === "unreachable" ? "xUnreachable" : "xSubscribe");
  return NextResponse.redirect(`${origin}/w/${slug}/channels/${id}?created=1`);
}
