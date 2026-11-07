"use server";

import { redirect } from "next/navigation";
import { CURRENCIES } from "@/lib/currencies";
import { loadWorkspace } from "@/lib/workspace";

/** The workspace's currency (decided 2026-11-03): one for the whole workspace, chosen by the owner. */
export async function setCurrency(data: FormData) {
  const slug = String(data.get("slug"));
  const currency = String(data.get("currency") ?? "");
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!CURRENCIES.includes(currency)) redirect(`/w/${slug}/money?error=failed`);
  const { error } = await supabase.rpc("set_workspace_currency", { p_workspace: workspace.id, p_currency: currency });
  if (error) redirect(`/w/${slug}/money?error=${error.message.includes("not_allowed") ? "notAllowed" : "failed"}`);
  redirect(`/w/${slug}/money?saved=1`);
}
