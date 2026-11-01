import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { appOrigin } from "@/lib/app-origin";
import { xAuthorizeUrl } from "@/lib/channels/x-api";
import { newAttempt } from "@/lib/oauth/google";
import { can, loadWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
const COOKIE = "relay_oauth_x";

/**
 * Starts the login of the business's X account, with the business's own developer app (decided 2026-11-02). The channel
 * already holds the app's client id and secret. Only people who manage channels may start it.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("slug") ?? "";
  const id = params.get("id") ?? "";
  if (!/^[a-z0-9-]{2,60}$/.test(slug) || !z.uuid().safeParse(id).success) return new NextResponse("Bad request", { status: 400 });
  const origin = await appOrigin();
  const back = (error: string) => NextResponse.redirect(`${origin}/w/${slug}/channels/${id}?error=${error}`);

  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return back("notAllowed");
  const { data: ch } = await supabase.from("channels").select("id, settings").eq("id", id).eq("workspace_id", workspace.id).eq("type", "x").maybeSingle();
  const clientId = (ch?.settings as { client_id?: string } | null)?.client_id;
  if (!ch || !clientId) return back("failed");
  if (!origin.startsWith("https://")) return back("needHttps");

  const attempt = newAttempt();
  (await cookies()).set(COOKIE, JSON.stringify({ state: attempt.state, verifier: attempt.verifier, slug, id }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/oauth/x",
    maxAge: 600,
  });
  return NextResponse.redirect(xAuthorizeUrl(clientId, `${origin}/api/oauth/x/callback`, attempt.state, attempt.challenge));
}
