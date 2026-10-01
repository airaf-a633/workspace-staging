"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE, accessToken, passwordMatches, previewMode, safeNextPath } from "@/lib/preview-gate";

export async function unlock(form: FormData) {
  const next = safeNextPath(String(form.get("next") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!previewMode()) redirect("/");
  if (!passwordMatches(password)) redirect(`/unlock?error=1&next=${encodeURIComponent(next)}`);

  (await cookies()).set(PREVIEW_COOKIE, accessToken(password), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next);
}
