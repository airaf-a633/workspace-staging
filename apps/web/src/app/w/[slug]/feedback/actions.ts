"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadWorkspace } from "@/lib/workspace";

/**
 * Pilot feedback (decided 2026-11-05): one database function stores it; errors go back as short codes the page words
 * (pilotFeedback.errors.<code>). The screen the person came from is kept so the founder knows where to look.
 */
export async function sendFeedback(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const parsed = z
    .object({ kind: z.enum(["broken", "confusing", "wish", "other"]), body: z.string().trim().min(1).max(4000), from: z.string().max(200) })
    .safeParse({ kind: form.get("kind"), body: form.get("body"), from: String(form.get("from") ?? "") });
  if (!parsed.success) redirect(`/w/${slug}/feedback?error=needMessage`);
  // Only a path on this site, never a full address.
  const page = parsed.data.from.startsWith("/") && !parsed.data.from.startsWith("//") ? parsed.data.from : null;
  const { error } = await supabase.rpc("send_feedback", { p_workspace: workspace.id, p_kind: parsed.data.kind, p_body: parsed.data.body, p_page: page });
  if (error) redirect(`/w/${slug}/feedback?error=${error.message.includes("too_many") ? "tooMany" : "failed"}`);
  redirect(`/w/${slug}/feedback?sent=1`);
}
