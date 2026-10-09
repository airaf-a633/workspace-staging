import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PREVIEW_COOKIE, previewMode, tokenIsValid } from "@/lib/preview-gate";

const PROTECTED = ["/app", "/w/"];

/** The real app's paths; on the partner preview they're switched off (nothing may reach the staging database). */
const REAL_APP = ["/app", "/w", "/sign-in", "/sign-up", "/invite", "/auth", "/api"];
const OPEN_ON_PREVIEW = ["/unlock", "/robots.txt"];

/**
 * Hosted partner preview: one shared password in front of everything, the real app redirected to /preview,
 * and every response marked noindex.
 */
function previewGate(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const url = request.nextUrl.clone();

  if (!process.env.PREVIEW_PASSWORD) {
    return new NextResponse("This preview isn't configured yet: set PREVIEW_PASSWORD in the hosting settings.", { status: 503 });
  }

  const isOpen = OPEN_ON_PREVIEW.some((p) => path === p || path.startsWith(`${p}/`));
  if (!isOpen && !tokenIsValid(request.cookies.get(PREVIEW_COOKIE)?.value)) {
    url.pathname = "/unlock";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (REAL_APP.some((p) => path === p || path.startsWith(`${p}/`))) {
    if (path.startsWith("/api")) return new NextResponse("Not available on the preview.", { status: 404 });
    url.pathname = path.startsWith("/sign-up") ? "/preview/sign-up" : "/preview";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({ request });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out visitors
 * away from app pages. This is only an optimistic check: every page and action still
 * verifies the user, and the database enforces permissions.
 */
export async function proxy(request: NextRequest) {
  if (previewMode()) return previewGate(request);

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!data.user && PROTECTED.some((p) => path === p || path.startsWith(p))) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(signIn);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)"],
};
