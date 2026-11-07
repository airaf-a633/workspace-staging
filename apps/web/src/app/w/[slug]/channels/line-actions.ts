"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getBotInfo } from "@/lib/channels/line-api";
import { can, loadWorkspace } from "@/lib/workspace";

/**
 * Connecting a LINE account (decided 2026-11-01). The owner pastes the channel secret and the long-lived access
 * token from the LINE Developers Console. The token is checked with LINE (Get bot info) before anything is saved,
 * both are stored in Vault by the database, and the owner then pastes Relay's webhook address into the console.
 */

export type LineError = "needSecret" | "needToken" | "badToken" | "noAccountId" | "unreachable" | "already" | "otherAccount" | "otherLine" | "notAllowed" | "needName" | "failed";
export type LineState = { error: LineError; detail?: string } | null;

const credential = z.string().trim().min(10).max(500).regex(/^\S+$/);
const greetingOf = (data: FormData) => String(data.get("greeting") ?? "").trim().slice(0, 1000);
const why = (message: string): LineError => (message.includes("not_allowed") ? "notAllowed" : message.includes("need_name") ? "needName" : message.includes("already_connected") ? "otherAccount" : "failed");

export async function connectLine(_prev: LineState, data: FormData): Promise<LineState> {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const secret = credential.safeParse(data.get("secret"));
  const token = credential.safeParse(data.get("token"));
  if (!secret.success) return { error: "needSecret" };
  if (!token.success) return { error: "needToken" };

  const bot = await getBotInfo(fetch, token.data);
  if (!bot.ok) return { error: bot.reason === "unreachable" ? "unreachable" : bot.reason === "unknown_account" ? "noAccountId" : "badToken", ...(bot.description ? { detail: bot.description } : {}) };

  const settings = { bot_user_id: bot.value.userId, greeting: greetingOf(data) };
  const secrets = { channel_secret: secret.data, access_token: token.data };

  // The same account connected earlier and then disconnected is brought back; one that is live is refused.
  const { data: existing } = await supabase.from("channels").select("id, status").eq("workspace_id", workspace.id).eq("type", "line").eq("external_id", bot.value.userId).maybeSingle();
  let id: string;
  if (existing) {
    if (existing.status !== "disconnected") return { error: "already" };
    const { error } = await supabase.rpc("update_channel_credentials", { p_channel: existing.id, p_settings: settings, p_secrets: secrets, p_name: bot.value.name });
    if (error) return { error: why(error.message) };
    id = existing.id;
  } else {
    const { data: made, error } = await supabase.rpc("connect_channel", { p_workspace: workspace.id, p_type: "line", p_name: bot.value.name, p_external_id: bot.value.userId, p_settings: settings, p_secrets: secrets });
    if (error) return { error: why(error.message) };
    id = (made as { id: string }).id;
  }
  redirect(`/w/${slug}/channels/${id}?created=1`);
}

/** The account's name and greeting. Never changes whether it is connected. */
export async function updateLine(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: { greeting: greetingOf(data) }, p_secrets: {}, p_name: String(data.get("name") ?? "").trim() });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** A new access token (and optionally a new channel secret) for the same LINE account. */
export async function replaceLineCredentials(_prev: LineState, data: FormData): Promise<LineState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const token = credential.safeParse(data.get("token"));
  if (!token.success) return { error: "needToken" };
  const secretRaw = String(data.get("secret") ?? "").trim();
  const secret = secretRaw ? credential.safeParse(secretRaw) : null;
  if (secret && !secret.success) return { error: "needSecret" };
  const { data: ch } = await supabase.from("channels").select("external_id").eq("id", id).eq("type", "line").maybeSingle();
  if (!ch) return { error: "failed" };

  const bot = await getBotInfo(fetch, token.data);
  if (!bot.ok) return { error: bot.reason === "unreachable" ? "unreachable" : bot.reason === "unknown_account" ? "noAccountId" : "badToken", ...(bot.description ? { detail: bot.description } : {}) };
  if (bot.value.userId !== ch.external_id) return { error: "otherLine" };
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: {}, p_secrets: { access_token: token.data, ...(secret?.success ? { channel_secret: secret.data } : {}) } });
  if (error) return { error: why(error.message) };
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** Marks the channel disconnected. The owner also turns off "Use webhook" in the LINE console (Relay can't do that). */
export async function disconnectLine(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("disconnect_channel", { p_channel: id });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels?add=1`);
}
