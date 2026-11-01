"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { appOrigin } from "@/lib/app-origin";
import { botFingerprint, checkBotToken } from "@/lib/channels/discord-api";
import { can, loadWorkspace } from "@/lib/workspace";

/**
 * Connecting a Discord bot (decided 2026-11-02): the business makes its own bot in Discord's Developer Portal and pastes
 * its token. The token is checked with Discord first, then stored in Vault by the database. The always-on Gateway
 * process then connects the bot and reports its ids and health back (the invite link appears once it has).
 */

export type DiscordError = "needToken" | "badToken" | "unreachable" | "already" | "otherAccount" | "notAllowed" | "needName" | "failed";
export type DiscordState = { error: DiscordError } | null;

const tokenSchema = z.string().trim().min(20).max(200).regex(/^\S+$/);
const why = (message: string): DiscordError => (message.includes("not_allowed") ? "notAllowed" : message.includes("need_name") ? "needName" : message.includes("already_connected") ? "otherAccount" : "failed");

export async function connectDiscord(_prev: DiscordState, data: FormData): Promise<DiscordState> {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const token = tokenSchema.safeParse(data.get("token"));
  if (!token.success) return { error: "needToken" };
  const name = String(data.get("name") ?? "").trim() || "Discord";

  const check = await checkBotToken(fetch, token.data, await appOrigin());
  if (!check.ok) return { error: check.reason === "unreachable" ? "unreachable" : "badToken" };

  // Brought back if the same bot was disconnected earlier; refused if it is live (here or in another account).
  const fingerprint = botFingerprint(token.data);
  const { data: existing } = await supabase.from("channels").select("id, status").eq("workspace_id", workspace.id).eq("type", "discord").eq("external_id", fingerprint).maybeSingle();
  let id: string;
  if (existing) {
    if (existing.status !== "disconnected") return { error: "already" };
    const { error } = await supabase.rpc("update_channel_credentials", { p_channel: existing.id, p_settings: {}, p_secrets: { bot_token: token.data }, p_name: name });
    if (error) return { error: why(error.message) };
    id = existing.id;
  } else {
    const { data: made, error } = await supabase.rpc("connect_channel", { p_workspace: workspace.id, p_type: "discord", p_name: name, p_external_id: fingerprint, p_settings: {}, p_secrets: { bot_token: token.data } });
    if (error) return { error: why(error.message) };
    id = (made as { id: string }).id;
  }
  redirect(`/w/${slug}/channels/${id}?created=1`);
}

/** The name shown in the inbox. Never changes whether it is connected. */
export async function updateDiscord(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: {}, p_secrets: {}, p_name: String(data.get("name") ?? "").trim() });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** A new token for the same bot (for instance after resetting it in the Developer Portal). */
export async function replaceDiscordToken(_prev: DiscordState, data: FormData): Promise<DiscordState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const token = tokenSchema.safeParse(data.get("token"));
  if (!token.success) return { error: "needToken" };
  const { data: ch } = await supabase.from("channels").select("id").eq("id", id).eq("type", "discord").maybeSingle();
  if (!ch) return { error: "failed" };
  const check = await checkBotToken(fetch, token.data, await appOrigin());
  if (!check.ok) return { error: check.reason === "unreachable" ? "unreachable" : "badToken" };
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: {}, p_secrets: { bot_token: token.data } });
  if (error) return { error: why(error.message) };
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** Marks the bot disconnected: the Gateway process drops its connection. Relay can't remove the bot from servers. */
export async function disconnectDiscord(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("disconnect_channel", { p_channel: id });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels?add=1`);
}
