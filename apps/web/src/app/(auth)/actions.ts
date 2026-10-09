"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adoptProfileLocale } from "@/i18n/profile";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/public-env";
import { safeNext } from "@/lib/safe-next";

/*
 * Errors travel back to the page as short codes (auth.errors.<code>), never as sentences:
 * the page shows them in the reader's language, and no personal data ends up in a URL.
 */
const email = z.email("invalidEmail").transform((v) => v.trim().toLowerCase());
const password = z.string().min(10, "shortPassword");

function back(path: string, next: string, error: string): never {
  redirect(`${path}?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error)}`);
}

export async function signInWithPassword(form: FormData) {
  const next = safeNext(form.get("next"));
  const parsed = z.object({ email, password: z.string().min(1, "needPassword") }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) back("/sign-in", next, parsed.error.issues[0]!.message);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) back("/sign-in", next, "badLogin");
  await adoptProfileLocale(supabase, data.user.id);
  redirect(next);
}

export async function sendMagicLink(form: FormData) {
  const next = safeNext(form.get("next"));
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) back("/sign-in", next, parsed.error.issues[0]!.message);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${publicEnv().siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  // Same message whether or not the account exists, so the form can't be used to discover accounts.
  if (error && error.status !== 400 && error.status !== 422) back("/sign-in", next, "linkFailed");
  redirect(`/sign-in?sent=1&next=${encodeURIComponent(next)}`);
}

export async function signUp(form: FormData) {
  const next = safeNext(form.get("next"));
  const parsed = z
    .object({ name: z.string().trim().min(1, "needName").max(80, "needName"), email, password })
    .safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) back("/sign-up", next, parsed.error.issues[0]!.message);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${publicEnv().siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) back("/sign-up", next, error.status === 429 ? "tooMany" : "signUpFailed");
  if (!data.session) redirect(`/sign-up?confirm=1&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
