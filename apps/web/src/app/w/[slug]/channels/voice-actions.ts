"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { e164, getAccount } from "@/lib/channels/twilio";
import { MAX_SAY, RING_DEFAULT, RING_MAX, RING_MIN } from "@/lib/channels/voice-twiml";
import { can, loadWorkspace } from "@/lib/workspace";

/**
 * Connecting a phone line (decided 2026-11-02): the customer's own Twilio account and one of its numbers, like SMS.
 * Calls ring a phone the owner chooses, and unanswered calls go to a voicemail the team can play in the inbox.
 * The Account SID and Auth Token are checked with Twilio first, then stored in Vault by the database. The owner
 * then pastes Relay's address into the number's settings in the Twilio console.
 */

export type VoiceError =
  | "needSid" | "needToken" | "needNumber" | "badForward" | "forwardSelf" | "badRing" | "tooLong"
  | "badCredentials" | "unreachable" | "already" | "otherAccount" | "notAllowed" | "needName" | "failed";
export type VoiceState = { error: VoiceError; detail?: string } | null;

const sidSchema = z.string().trim().regex(/^AC[A-Za-z0-9]{32}$/);
const tokenSchema = z.string().trim().min(16).max(200).regex(/^\S+$/);
const why = (message: string): VoiceError => (message.includes("not_allowed") ? "notAllowed" : message.includes("need_name") ? "needName" : message.includes("already_connected") ? "otherAccount" : "failed");

/** The phone to ring: empty means none (every call goes to the voicemail), otherwise a valid number that is not this line. */
function forwardTarget(raw: FormDataEntryValue | null, own: string | null): { ok: true; value: string } | { ok: false; error: VoiceError } {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: true, value: "" };
  const number = e164(text);
  if (!number) return { ok: false, error: "badForward" };
  if (own && number === own) return { ok: false, error: "forwardSelf" };
  return { ok: true, value: number };
}

export async function connectVoice(_prev: VoiceState, data: FormData): Promise<VoiceState> {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const sid = sidSchema.safeParse(data.get("sid"));
  const token = tokenSchema.safeParse(data.get("token"));
  const number = e164(String(data.get("number") ?? ""));
  if (!sid.success) return { error: "needSid" };
  if (!token.success) return { error: "needToken" };
  if (!number) return { error: "needNumber" };
  const forward = forwardTarget(data.get("forward"), number);
  if (!forward.ok) return { error: forward.error };

  const account = await getAccount(fetch, sid.data, token.data);
  if (!account.ok) return { error: account.reason === "unreachable" ? "unreachable" : "badCredentials", ...(account.description ? { detail: account.description } : {}) };

  const settings = { number, account_name: account.value.name, forward_to: forward.value, ring_seconds: RING_DEFAULT };
  const secrets = { account_sid: sid.data, auth_token: token.data };

  // The same number connected earlier and then disconnected is brought back; one that is live is refused.
  const { data: existing } = await supabase.from("channels").select("id, status").eq("workspace_id", workspace.id).eq("type", "voice").eq("external_id", number).maybeSingle();
  let id: string;
  if (existing) {
    if (existing.status !== "disconnected") return { error: "already" };
    const { error } = await supabase.rpc("update_channel_credentials", { p_channel: existing.id, p_settings: settings, p_secrets: secrets, p_name: number });
    if (error) return { error: why(error.message) };
    id = existing.id;
  } else {
    const { data: made, error } = await supabase.rpc("connect_channel", { p_workspace: workspace.id, p_type: "voice", p_name: number, p_external_id: number, p_settings: settings, p_secrets: secrets });
    if (error) return { error: why(error.message) };
    id = (made as { id: string }).id;
  }
  redirect(`/w/${slug}/channels/${id}?created=1`);
}

/** Name, the phone to ring, how long to ring, and the two things callers hear. Never changes whether it is connected. */
export async function updateVoice(_prev: VoiceState, data: FormData): Promise<VoiceState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const name = String(data.get("name") ?? "").trim();
  if (!name) return { error: "needName" };
  const { data: ch } = await supabase.from("channels").select("id, external_id").eq("id", id).eq("type", "voice").maybeSingle();
  if (!ch) return { error: "failed" };
  const forward = forwardTarget(data.get("forward"), ch.external_id);
  if (!forward.ok) return { error: forward.error };
  const ring = Number.parseInt(String(data.get("ring") ?? ""), 10);
  if (!Number.isFinite(ring) || ring < RING_MIN || ring > RING_MAX) return { error: "badRing" };
  // A cleared notice is kept as cleared (callers then hear none); only a field that was never set uses the default.
  const greeting = String(data.get("greeting") ?? "").trim();
  const notice = String(data.get("notice") ?? "").trim();
  if (greeting.length > MAX_SAY || notice.length > MAX_SAY) return { error: "tooLong" };
  const { error } = await supabase.rpc("update_channel_credentials", {
    p_channel: id,
    p_settings: { forward_to: forward.value, ring_seconds: ring, greeting, notice },
    p_secrets: {},
    p_name: name,
  });
  if (error) return { error: why(error.message) };
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** New credentials for the same Twilio account (for instance after rotating the Auth Token), or bringing a disconnected line back. */
export async function replaceVoiceCredentials(_prev: VoiceState, data: FormData): Promise<VoiceState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const sid = sidSchema.safeParse(data.get("sid"));
  const token = tokenSchema.safeParse(data.get("token"));
  if (!sid.success) return { error: "needSid" };
  if (!token.success) return { error: "needToken" };
  const { data: ch } = await supabase.from("channels").select("id").eq("id", id).eq("type", "voice").maybeSingle();
  if (!ch) return { error: "failed" };

  const account = await getAccount(fetch, sid.data, token.data);
  if (!account.ok) return { error: account.reason === "unreachable" ? "unreachable" : "badCredentials", ...(account.description ? { detail: account.description } : {}) };
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: { account_name: account.value.name }, p_secrets: { account_sid: sid.data, auth_token: token.data } });
  if (error) return { error: why(error.message) };
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** Marks the line disconnected. The owner also clears the webhook on the number in Twilio (Relay can't do that). */
export async function disconnectVoice(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("disconnect_channel", { p_channel: id });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels?add=1`);
}
