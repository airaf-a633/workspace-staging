import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/app-origin";
import { OAUTH_COOKIE, authorizeUrl, microsoftConfigured, newAttempt } from "@/lib/oauth/microsoft";
import { can, loadWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/** Starts "Continue with Outlook" for a workspace. Only people who manage channels may start it. */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return new NextResponse("Bad request", { status: 400 });
  const origin = await appOrigin();
  const back = (error: string) => NextResponse.redirect(`${origin}/w/${slug}/channels/new/outlook?error=${error}`);
  if (!microsoftConfigured()) return back("notConfigured");

  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return back("notAllowed");

  const attempt = newAttempt();
  (await cookies()).set(OAUTH_COOKIE, JSON.stringify({ state: attempt.state, verifier: attempt.verifier, slug }), {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/api/oauth/microsoft",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl(`${origin}/api/oauth/microsoft/callback`, attempt.state, attempt.challenge));
}
