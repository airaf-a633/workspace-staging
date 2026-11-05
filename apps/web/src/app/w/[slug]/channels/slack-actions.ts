"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadWorkspace } from "@/lib/workspace";

/**
 * A connected Slack workspace (decided 2026-11-02). Connecting happens through "Add to Slack" (the OAuth routes under
 * /api/oauth/slack), not a form. Here the team can rename the inbox and disconnect it; replacing access means adding
 * Relay to Slack again.
 */

const why = (message: string) => (message.includes("not_allowed") ? "notAllowed" : message.includes("need_name") ? "needName" : "failed");

/** The name shown in the inbox. Never changes whether it is connected. */
export async function updateSlack(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: {}, p_secrets: {}, p_name: String(data.get("name") ?? "").trim() });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** Marks the workspace disconnected. The owner also removes the Relay app in Slack (Relay can't do that for them). */
export async function disconnectSlack(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("disconnect_channel", { p_channel: id });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels?add=1`);
}
