"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadWorkspace } from "@/lib/workspace";

/** Website chat setup (decided 2026-10-19). The database functions check that the person may manage channels. */
const form = z.object({
  name: z.string().trim().min(1, "needName").max(80, "needName"),
  site: z.string().trim().max(200).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).catch("#006ACC"),
  greeting: z.string().trim().max(280).optional(),
  position: z.enum(["left", "right"]).catch("right"),
});

function settingsFrom(data: FormData) {
  const parsed = form.safeParse({
    name: data.get("name"),
    site: data.get("site") ?? undefined,
    color: data.get("color"),
    greeting: data.get("greeting") ?? undefined,
    position: data.get("position"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message } as const;
  const { name, site, ...look } = parsed.data;
  // The site is kept as a bare domain ("example.com"): shown in setup, and where the widget is expected to run.
  const domain = (site ?? "").replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  return { name, settings: { ...look, domains: domain } } as const;
}

export async function createWebchat(data: FormData) {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const s = settingsFrom(data);
  if ("error" in s) redirect(`/w/${slug}/channels/new/webchat?error=${s.error}`);
  const { data: id, error } = await supabase.rpc("create_webchat_channel", { p_workspace: workspace.id, p_name: s.name, p_settings: s.settings });
  if (error) redirect(`/w/${slug}/channels/new/webchat?error=${error.message.includes("not_allowed") ? "notAllowed" : "failed"}`);
  redirect(`/w/${slug}/channels/${id}?created=1`);
}

export async function updateWebchat(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const s = settingsFrom(data);
  if ("error" in s) redirect(`/w/${slug}/channels/${id}?error=${s.error}`);
  const { error } = await supabase.rpc("update_webchat_channel", { p_channel: id, p_name: s.name, p_settings: s.settings });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${error.message.includes("not_allowed") ? "notAllowed" : "failed"}`);
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}
