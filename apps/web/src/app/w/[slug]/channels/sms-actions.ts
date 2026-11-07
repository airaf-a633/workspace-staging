"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { e164, getAccount } from "@/lib/channels/twilio";
import { can, loadWorkspace } from "@/lib/workspace";

/**
 * Connecting an SMS number (decided 2026-11-01): the customer's own Twilio account, one phone number per inbox.
 * The Account SID and Auth Token are checked with Twilio before anything is saved, then stored in Vault by the
 * database. The Auth Token is also the key Twilio signs its webhooks with, so it is required. The owner then
 * pastes Relay's address into the number's settings in the Twilio console.
 */

export type SmsError = "needSid" | "needToken" | "needNumber" | "badCredentials" | "unreachable" | "already" | "otherAccount" | "otherTwilio" | "notAllowed" | "needName" | "failed";
export type SmsState = { error: SmsError; detail?: string } | null;

const sidSchema = z.string().trim().regex(/^AC[A-Za-z0-9]{32}$/);
const tokenSchema = z.string().trim().min(16).max(200).regex(/^\S+$/);
const why = (message: string): SmsError => (message.includes("not_allowed") ? "notAllowed" : message.includes("need_name") ? "needName" : message.includes("already_connected") ? "otherAccount" : "failed");

export async function connectSms(_prev: SmsState, data: FormData): Promise<SmsState> {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const sid = sidSchema.safeParse(data.get("sid"));
  const token = tokenSchema.safeParse(data.get("token"));
  const number = e164(String(data.get("number") ?? ""));
  if (!sid.success) return { error: "needSid" };
  if (!token.success) return { error: "needToken" };
  if (!number) return { error: "needNumber" };

  const account = await getAccount(fetch, sid.data, token.data);
  if (!account.ok) return { error: account.reason === "unreachable" ? "unreachable" : "badCredentials", ...(account.description ? { detail: account.description } : {}) };

  const settings = { number, account_name: account.value.name };
  const secrets = { account_sid: sid.data, auth_token: token.data };

  // The same number connected earlier and then disconnected is brought back; one that is live is refused.
  const { data: existing } = await supabase.from("channels").select("id, status").eq("workspace_id", workspace.id).eq("type", "sms").eq("external_id", number).maybeSingle();
  let id: string;
  if (existing) {
    if (existing.status !== "disconnected") return { error: "already" };
    const { error } = await supabase.rpc("update_channel_credentials", { p_channel: existing.id, p_settings: settings, p_secrets: secrets, p_name: number });
    if (error) return { error: why(error.message) };
    id = existing.id;
  } else {
    const { data: made, error } = await supabase.rpc("connect_channel", { p_workspace: workspace.id, p_type: "sms", p_name: number, p_external_id: number, p_settings: settings, p_secrets: secrets });
    if (error) return { error: why(error.message) };
    id = (made as { id: string }).id;
  }
  redirect(`/w/${slug}/channels/${id}?created=1`);
}

/** The name shown in the inbox. Never changes whether it is connected. */
export async function updateSms(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: {}, p_secrets: {}, p_name: String(data.get("name") ?? "").trim() });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** New credentials for the same Twilio account (for instance after rotating the Auth Token). */
export async function replaceSmsCredentials(_prev: SmsState, data: FormData): Promise<SmsState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const sid = sidSchema.safeParse(data.get("sid"));
  const token = tokenSchema.safeParse(data.get("token"));
  if (!sid.success) return { error: "needSid" };
  if (!token.success) return { error: "needToken" };
  const { data: ch } = await supabase.from("channels").select("id").eq("id", id).eq("type", "sms").maybeSingle();
  if (!ch) return { error: "failed" };

  const account = await getAccount(fetch, sid.data, token.data);
  if (!account.ok) return { error: account.reason === "unreachable" ? "unreachable" : "badCredentials", ...(account.description ? { detail: account.description } : {}) };
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: { account_name: account.value.name }, p_secrets: { account_sid: sid.data, auth_token: token.data } });
  if (error) return { error: why(error.message) };
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** Marks the inbox disconnected. The owner also clears the webhook on the number in Twilio (Relay can't do that). */
export async function disconnectSms(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("disconnect_channel", { p_channel: id });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels?add=1`);
}
