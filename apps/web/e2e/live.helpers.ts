import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { resolve } from "node:path";

/* Shared by the live suite. The seed people (supabase/seed.sql) exist on staging; the workspace is "qamar". */
try {
  process.loadEnvFile(resolve(__dirname, "../../../.env"));
} catch {
  /* the variables may already be set */
}

export const SLUG = "qamar";
export const PASSWORD = "Password1234";
export const PEOPLE = {
  owner: "khalid@qamar.test",
  agent: "hana@qamar.test",
  viewer: "aisha@qamar.test",
  outsider: "noor@noor.test",
} as const;

export const live = process.env.E2E_LIVE === "1";

export async function signIn(page: Page, who: keyof typeof PEOPLE) {
  await page.goto(`/sign-in?next=${encodeURIComponent(`/w/${SLUG}`)}`);
  // The page has two forms with an Email field (password sign-in, and "email me a link"): use the one with the password.
  const form = page.locator("form").filter({ has: page.getByLabel("Password") });
  await form.getByLabel("Email").fill(PEOPLE[who]);
  await form.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/w\//);
}

/** A supabase client signed in as one of the seed people, for setting up data the way the app does. */
export async function clientAs(who: keyof typeof PEOPLE) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await supabase.auth.signInWithPassword({ email: PEOPLE[who], password: PASSWORD });
  if (error) throw error;
  return supabase;
}

export const unique = (p: string) => `${p} ${Date.now().toString(36)}`;

/** Opens the inbox on its "All" tab. The inbox starts on "Mine" (or "Waiting for someone" when nothing is yours), so a test that is
 *  looking for a brand-new customer's message asks for every chat. */
export async function openInbox(page: Page) {
  await page.goto(`/w/${SLUG}/inbox`);
  await page.getByRole("button", { name: /^All \d+$/ }).click();
}
