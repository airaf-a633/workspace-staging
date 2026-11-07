"use server";

import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/workspace";

/**
 * "Request access" for a channel that cannot be connected yet (decided 2026-11-02): TikTok, WeChat and Apple Messages.
 * It only saves who asked and an optional note. Nothing is sent to the platform or to anyone else.
 */

export type AccessChannel = "tiktok" | "wechat" | "apple";
const ACCESS_CHANNELS: readonly string[] = ["tiktok", "wechat", "apple"];

export type AccessState = { error: "notAllowed" | "tooLong" | "failed" } | null;

export async function requestAccess(_prev: AccessState, data: FormData): Promise<AccessState> {
  const slug = String(data.get("slug"));
  const channel = String(data.get("channel"));
  if (!ACCESS_CHANNELS.includes(channel)) return { error: "failed" };
  const note = String(data.get("note") ?? "").trim();
  if (note.length > 500) return { error: "tooLong" };
  const { supabase, workspace } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("request_channel_access", { p_workspace: workspace.id, p_channel: channel, p_note: note });
  if (error) return { error: error.message.includes("not_allowed") ? "notAllowed" : "failed" };
  redirect(`/w/${slug}/channels/new/${channel}?requested=1`);
}
