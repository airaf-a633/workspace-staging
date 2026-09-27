"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";

/** "Qamar Electronics" -> "qamar-electronics-4f2a" (suffix avoids clashes without asking the user). */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = crypto.randomUUID().slice(0, 4);
  return `${base || "workspace"}-${suffix}`;
}

export async function createWorkspace(form: FormData) {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/app");
  const parsed = z.string().trim().min(1, "Enter your business name.").max(120).safeParse(form.get("name"));
  if (!parsed.success) redirect(`/app?error=${encodeURIComponent(parsed.error.issues[0]!.message)}`);

  const displayName = (user.user_metadata?.name as string | undefined)?.trim() || user.email!.split("@")[0]!;
  const slug = slugify(parsed.data);
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_workspace", { p_name: parsed.data, p_slug: slug, p_display_name: displayName });
  if (error) redirect(`/app?error=${encodeURIComponent("Couldn't create the workspace. Try again.")}`);
  redirect(`/w/${slug}`);
}
