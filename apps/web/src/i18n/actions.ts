"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale } from "./config";

/**
 * Switch the interface language. The cookie decides what this device shows; a signed-in member's
 * choice is also saved on their member rows (members.locale), so it follows them to a new device.
 */
export async function setLocale(locale: string, opts: { saveToProfile?: boolean } = {}) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });

  if (opts.saveToProfile) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // The members_self_update policy and column grants allow exactly this: your own rows, locale only.
    if (user) await supabase.from("members").update({ locale }).eq("user_id", user.id);
  }
  revalidatePath("/", "layout");
}
