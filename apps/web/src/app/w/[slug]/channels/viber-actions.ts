"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { appOrigin } from "@/lib/app-origin";
import { getAccountInfo, removeWebhook, setWebhook } from "@/lib/channels/viber-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, loadWorkspace } from "@/lib/workspace";

/**
 * Connecting a Viber bot (decided 2026-11-02): the business already has a bot (Viber gives them only under a contract) and
 * pastes its token. The token is checked with Viber (get_account_info), stored in Vault by the database, and Relay then points
 * the bot's webhook at itself. If Viber can't reach that address the connection is undone, so the screen never says
 * "connected" while nothing can arrive.
 */

export type ViberError = "needToken" | "badToken" | "unreachable" | "needHttps" | "webhook" | "otherBot" | "tooLong" | "already" | "otherAccount" | "notAllowed" | "needName" | "failed";
export type ViberState = { error: ViberError; detail?: string } | null;

const tokenSchema = z.string().trim().min(8).max(200).regex(/^\S+$/);
const why = (message: string): ViberError => (message.includes("not_allowed") ? "notAllowed" : message.includes("need_name") ? "needName" : message.includes("already_connected") ? "otherAccount" : "failed");
const MAX_WELCOME = 500;

const clean = (data: FormData) => ({
  name: String(data.get("name") ?? "").trim(),
  senderName: String(data.get("senderName") ?? "").trim().slice(0, 28),
  welcome: String(data.get("welcome") ?? "").trim(),
});

export async function connectViber(_prev: ViberState, data: FormData): Promise<ViberState> {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const token = tokenSchema.safeParse(data.get("token"));
  if (!token.success) return { error: "needToken" };
  const form = clean(data);
  if (form.welcome.length > MAX_WELCOME) return { error: "tooLong" };
  const origin = await appOrigin();
  if (!origin.startsWith("https://")) return { error: "needHttps" };

  const account = await getAccountInfo(fetch, token.data);
  if (!account.ok) return { error: account.reason === "unreachable" ? "unreachable" : "badToken", ...(account.reason === "rejected" && account.message ? { detail: account.message } : {}) };
  const { id: accountId, name: accountName } = account.value;
  const name = form.name || accountName.slice(0, 80) || "Viber";
  const settings = { account_id: accountId, account_name: accountName, sender_name: form.senderName || accountName.slice(0, 28) || "Support", welcome: form.welcome };
  const secrets = { auth_token: token.data };

  const { data: existing } = await supabase.from("channels").select("id, status, settings").eq("workspace_id", workspace.id).eq("type", "viber").eq("external_id", accountId).maybeSingle();
  let id: string;
  let key: string;
  if (existing) {
    if (existing.status !== "disconnected") return { error: "already" };
    const { error } = await supabase.rpc("update_channel_credentials", { p_channel: existing.id, p_settings: settings, p_secrets: secrets, p_name: name });
    if (error) return { error: why(error.message) };
    id = existing.id;
    key = (existing.settings as { webhook_key?: string }).webhook_key ?? "";
  } else {
    const { data: made, error } = await supabase.rpc("connect_channel", { p_workspace: workspace.id, p_type: "viber", p_name: name, p_external_id: accountId, p_settings: settings, p_secrets: secrets });
    if (error) return { error: why(error.message) };
    ({ id, key } = made as { id: string; key: string });
  }

  const hook = await setWebhook(fetch, token.data, `${origin}/api/webhooks/viber/${key}`);
  if (!hook.ok) {
    await supabase.rpc("disconnect_channel", { p_channel: id });
    return { error: hook.reason === "unreachable" ? "unreachable" : "webhook", ...(hook.reason === "rejected" && hook.message ? { detail: hook.message } : {}) };
  }
  redirect(`/w/${slug}/channels/${id}?created=1`);
}

/** The name in the inbox, the name Viber shows on replies, and the welcome message. Never changes whether it is connected. */
export async function updateViber(_prev: ViberState, data: FormData): Promise<ViberState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const form = clean(data);
  if (!form.name) return { error: "needName" };
  if (form.welcome.length > MAX_WELCOME) return { error: "tooLong" };
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: { sender_name: form.senderName || "Support", welcome: form.welcome }, p_secrets: {}, p_name: form.name });
  if (error) return { error: why(error.message) };
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** A new token for the same bot (for instance after Viber issued a new one). The webhook is set again. */
export async function replaceViberToken(_prev: ViberState, data: FormData): Promise<ViberState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const token = tokenSchema.safeParse(data.get("token"));
  if (!token.success) return { error: "needToken" };
  const { data: ch } = await supabase.from("channels").select("id, settings").eq("id", id).eq("type", "viber").maybeSingle();
  const s = (ch?.settings ?? {}) as { account_id?: string; webhook_key?: string };
  if (!ch || !s.account_id) return { error: "failed" };
  const origin = await appOrigin();
  if (!origin.startsWith("https://")) return { error: "needHttps" };

  const account = await getAccountInfo(fetch, token.data);
  if (!account.ok) return { error: account.reason === "unreachable" ? "unreachable" : "badToken", ...(account.reason === "rejected" && account.message ? { detail: account.message } : {}) };
  if (account.value.id !== s.account_id) return { error: "otherBot" };
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: { account_name: account.value.name }, p_secrets: { auth_token: token.data } });
  if (error) return { error: why(error.message) };
  const hook = await setWebhook(fetch, token.data, `${origin}/api/webhooks/viber/${s.webhook_key}`);
  if (!hook.ok) return { error: hook.reason === "unreachable" ? "unreachable" : "webhook", ...(hook.reason === "rejected" && hook.message ? { detail: hook.message } : {}) };
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** Takes the webhook off the bot and marks it disconnected. */
export async function disconnectViber(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) redirect(`/w/${slug}/channels/${id}?error=notAllowed`);
  // The admin client sees every workspace, so first prove this channel is in the person's own workspace.
  const { data: own } = await supabase.from("channels").select("id").eq("id", id).eq("workspace_id", workspace.id).eq("type", "viber").maybeSingle();
  if (!own) redirect(`/w/${slug}/channels/${id}?error=failed`);
  const { data: secrets } = await createAdminClient().rpc("channel_secrets", { p_channel: id });
  const token = (secrets as { auth_token?: string } | null)?.auth_token;
  if (token) await removeWebhook(fetch, token); // best effort: the channel is disconnected either way
  const { error } = await supabase.rpc("disconnect_channel", { p_channel: id });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels?add=1`);
}
