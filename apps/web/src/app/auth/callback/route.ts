import { NextResponse, type NextRequest } from "next/server";
import { adoptProfileLocale } from "@/i18n/profile";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/** Magic links and sign-up confirmations land here with a one-time code. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await adoptProfileLocale(supabase, data.user.id);
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  const failed = new URL("/sign-in", request.url);
  failed.searchParams.set("error", "linkExpired");
  failed.searchParams.set("next", next);
  return NextResponse.redirect(failed);
}
