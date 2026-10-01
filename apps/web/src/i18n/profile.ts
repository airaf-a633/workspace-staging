import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOCALE_COOKIE, isLocale } from "./config";

/**
 * After signing in, show the app in the language the person chose before (members.locale), even on a new
 * device. Only an Arabic choice overrides the device; members default to English, which would otherwise
 * undo a switch made on the sign-in page.
 */
export async function adoptProfileLocale(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("members").select("locale").eq("user_id", userId).eq("status", "active").limit(1).maybeSingle();
  const locale = data?.locale;
  if (isLocale(locale) && locale !== "en") {
    (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
}
