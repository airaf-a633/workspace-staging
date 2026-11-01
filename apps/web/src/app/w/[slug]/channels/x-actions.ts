"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { can, loadWorkspace } from "@/lib/workspace";

/**
 * Connecting X (Twitter) through the business's own X developer app (decided 2026-11-02). They paste the app's client id,
 * client secret and bearer token; Relay saves them (the secrets in Vault) and sends the person to X to log in as the
 * account. The rest happens in /api/oauth/x/callback. X bills the business's developer account directly, so Relay carries
 * no cost.
 */

export type XError = "needClientId" | "needSecret" | "needBearer" | "already" | "otherAccount" | "notAllowed" | "needName" | "failed";
export type XState = { error: XError } | null;

const valueSchema = z.string().trim().min(8).max(400).regex(/^\S+$/);
const idSchema = z.string().trim().min(5).max(100).regex(/^\S+$/);
const why = (message: string): XError => (message.includes("not_allowed") ? "notAllowed" : message.includes("need_name") ? "needName" : message.includes("already_connected") ? "otherAccount" : "failed");

export async function connectX(_prev: XState, data: FormData): Promise<XState> {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const clientId = idSchema.safeParse(data.get("clientId"));
  const secret = valueSchema.safeParse(data.get("clientSecret"));
  const bearer = valueSchema.safeParse(data.get("bearerToken"));
  const name = String(data.get("name") ?? "").trim() || "X";
  if (!clientId.success) return { error: "needClientId" };
  if (!secret.success) return { error: "needSecret" };
  if (!bearer.success) return { error: "needBearer" };

  const settings = { client_id: clientId.data };
  const secrets = { client_secret: secret.data, bearer_token: bearer.data };
  // The same app connected earlier and then disconnected is brought back; one that is live is refused.
  const { data: existing } = await supabase.from("channels").select("id, status").eq("workspace_id", workspace.id).eq("type", "x").eq("external_id", clientId.data).maybeSingle();
  let id: string;
  if (existing) {
    if (existing.status !== "disconnected") return { error: "already" };
    const { error } = await supabase.rpc("update_channel_credentials", { p_channel: existing.id, p_settings: settings, p_secrets: secrets, p_name: name });
    if (error) return { error: why(error.message) };
    id = existing.id;
  } else {
    const { data: made, error } = await supabase.rpc("connect_channel", { p_workspace: workspace.id, p_type: "x", p_name: name, p_external_id: clientId.data, p_settings: settings, p_secrets: secrets });
    if (error) return { error: why(error.message) };
    id = (made as { id: string }).id;
  }
  // The next step is X's own login page, so this is a full navigation to the start route.
  redirect(`/api/oauth/x/start?slug=${encodeURIComponent(slug)}&id=${id}`);
}

/** The name shown in the inbox. Never changes whether it is connected. */
export async function updateX(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: {}, p_secrets: {}, p_name: String(data.get("name") ?? "").trim() });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** New app secrets (after resetting them in the X Developer Console). The account then logs in again. */
export async function replaceXSecrets(_prev: XState, data: FormData): Promise<XState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const secret = valueSchema.safeParse(data.get("clientSecret"));
  const bearer = valueSchema.safeParse(data.get("bearerToken"));
  if (!secret.success) return { error: "needSecret" };
  if (!bearer.success) return { error: "needBearer" };
  const { data: ch } = await supabase.from("channels").select("id").eq("id", id).eq("workspace_id", workspace.id).eq("type", "x").maybeSingle();
  if (!ch) return { error: "failed" };
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: {}, p_secrets: { client_secret: secret.data, bearer_token: bearer.data } });
  if (error) return { error: why(error.message) };
  redirect(`/api/oauth/x/start?slug=${encodeURIComponent(slug)}&id=${id}`);
}

/** Marks the channel disconnected. The business also removes the webhook in its X Developer Console (Relay doesn't). */
export async function disconnectX(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("disconnect_channel", { p_channel: id });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels?add=1`);
}
