"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appOrigin } from "@/lib/app-origin";
import { getMe, newSecretToken, removeWebhook, setWebhook } from "@/lib/channels/telegram-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, loadWorkspace } from "@/lib/workspace";

/**
 * Connecting a Telegram bot (decided 2026-11-01). The token is checked with Telegram (getMe), stored in Vault by
 * the database, and the bot is pointed at Relay with a secret that Telegram sends back on every call. Nothing
 * here keeps the token anywhere else, and no message ever contains it.
 */

export type TelegramError = "needToken" | "badToken" | "unreachable" | "needHttps" | "already" | "otherAccount" | "otherBot" | "webhook" | "notAllowed" | "needName" | "failed";
export type TelegramState = { error: TelegramError; detail?: string } | null;

const tokenSchema = z.string().trim().min(10).max(200).regex(/^\S+$/);
const greetingOf = (data: FormData) => String(data.get("greeting") ?? "").trim().slice(0, 1000);

const why = (message: string): TelegramError => (message.includes("not_allowed") ? "notAllowed" : message.includes("need_name") ? "needName" : message.includes("already_connected") ? "otherAccount" : "failed");

export async function connectTelegram(_prev: TelegramState, data: FormData): Promise<TelegramState> {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const parsed = tokenSchema.safeParse(data.get("token"));
  if (!parsed.success) return { error: "needToken" };
  const token = parsed.data;

  const me = await getMe(fetch, token);
  if (!me.ok) return { error: me.reason === "unreachable" ? "unreachable" : "badToken" };
  const origin = await appOrigin();
  if (!origin.startsWith("https://")) return { error: "needHttps" };

  const secret = newSecretToken(randomBytes);
  const greeting = greetingOf(data);
  const name = me.value.username ? `@${me.value.username}` : me.value.name;
  const settings = { username: me.value.username, bot_id: me.value.id, greeting };
  const secrets = { bot_token: token, secret_token: secret };

  // The same bot connected earlier and then disconnected is brought back; one that is live is refused.
  const { data: existing } = await supabase.from("channels").select("id, status, settings").eq("workspace_id", workspace.id).eq("type", "telegram").eq("external_id", String(me.value.id)).maybeSingle();
  let id: string;
  let key: string;
  if (existing) {
    if (existing.status !== "disconnected") return { error: "already" };
    const { error } = await supabase.rpc("update_channel_credentials", { p_channel: existing.id, p_settings: settings, p_secrets: secrets, p_name: name });
    if (error) return { error: why(error.message) };
    id = existing.id;
    key = (existing.settings as { webhook_key: string }).webhook_key;
  } else {
    const { data: made, error } = await supabase.rpc("connect_channel", { p_workspace: workspace.id, p_type: "telegram", p_name: name, p_external_id: String(me.value.id), p_settings: settings, p_secrets: secrets });
    if (error) return { error: why(error.message) };
    ({ id, key } = made as { id: string; key: string });
  }

  const hook = await setWebhook(fetch, token, `${origin}/api/webhooks/telegram/${key}`, secret);
  if (!hook.ok) {
    await supabase.rpc("disconnect_channel", { p_channel: id });
    return { error: hook.reason === "unreachable" ? "unreachable" : "webhook", ...(hook.ok === false && hook.description ? { detail: hook.description } : {}) };
  }
  redirect(`/w/${slug}/channels/${id}?created=1`);
}

/** The bot's name and greeting. Never changes whether it is connected. */
export async function updateTelegram(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const name = String(data.get("name") ?? "").trim();
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: { greeting: greetingOf(data) }, p_secrets: {}, p_name: name });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** A new token for the same bot (for instance after revoking the old one in BotFather). */
export async function replaceTelegramToken(_prev: TelegramState, data: FormData): Promise<TelegramState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const parsed = tokenSchema.safeParse(data.get("token"));
  if (!parsed.success) return { error: "needToken" };
  const token = parsed.data;
  const { data: ch } = await supabase.from("channels").select("external_id, settings").eq("id", id).eq("type", "telegram").maybeSingle();
  if (!ch) return { error: "failed" };

  const me = await getMe(fetch, token);
  if (!me.ok) return { error: me.reason === "unreachable" ? "unreachable" : "badToken" };
  if (String(me.value.id) !== ch.external_id) return { error: "otherBot" };
  const origin = await appOrigin();
  if (!origin.startsWith("https://")) return { error: "needHttps" };

  const secret = newSecretToken(randomBytes);
  const hook = await setWebhook(fetch, token, `${origin}/api/webhooks/telegram/${(ch.settings as { webhook_key: string }).webhook_key}`, secret);
  if (!hook.ok) return { error: hook.reason === "unreachable" ? "unreachable" : "webhook", ...(hook.description ? { detail: hook.description } : {}) };
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: {}, p_secrets: { bot_token: token, secret_token: secret } });
  if (error) return { error: why(error.message) };
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** Stops Telegram from calling Relay, then marks the channel disconnected. The history stays, read-only. */
export async function disconnectTelegram(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) redirect(`/w/${slug}/channels/${id}?error=notAllowed`);
  // The admin client sees every workspace, so first prove this channel is in the person's own workspace.
  const { data: own } = await supabase.from("channels").select("id").eq("id", id).eq("workspace_id", workspace.id).eq("type", "telegram").maybeSingle();
  if (!own) redirect(`/w/${slug}/channels/${id}?error=failed`);
  const { data: secrets } = await createAdminClient().rpc("channel_secrets", { p_channel: id });
  const token = (secrets as { bot_token?: string } | null)?.bot_token;
  if (token) await removeWebhook(fetch, token); // best effort: the channel is disconnected either way
  const { error } = await supabase.rpc("disconnect_channel", { p_channel: id });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels?add=1`);
}
