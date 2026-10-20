import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/app-origin";
import { OAUTH_COOKIE, exchangeCode, whoAmI } from "@/lib/oauth/microsoft";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Microsoft sends the person back here. We check the state against our cookie (so nobody can slip their own
 * account into someone else's workspace), swap the code for tokens with the PKCE verifier, and hand the refresh
 * token to the database, which keeps it in Vault. The person then picks which mailbox to connect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = await appOrigin();
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/api/oauth/microsoft" });

  let saved: { state: string; verifier: string; slug: string } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  if (!saved || !/^[a-z0-9-]{2,60}$/.test(saved.slug)) return NextResponse.redirect(`${origin}/app`);
  const back = (q: string) => NextResponse.redirect(`${origin}/w/${saved!.slug}/channels/new/outlook?${q}`);

  if (url.searchParams.get("error")) return back(`error=${url.searchParams.get("error") === "access_denied" ? "declined" : "failed"}`);
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== saved.state) return back("error=failed");

  try {
    const tokens = await exchangeCode(code, `${origin}/api/oauth/microsoft/callback`, saved.verifier);
    const account = await whoAmI(tokens.access_token);
    const { workspace } = await loadWorkspace(saved.slug);
    const supabase = await createClient();
    const { data: pending, error } = await supabase.rpc("start_mail_connection", {
      p_workspace: workspace.id, p_provider: "outlook", p_account: account, p_refresh_token: tokens.refresh_token,
    });
    if (error) return back(`error=${error.message.includes("not_allowed") ? "notAllowed" : "failed"}`);
    return back(`pending=${pending}`);
  } catch {
    return back("error=failed");
  }
}
