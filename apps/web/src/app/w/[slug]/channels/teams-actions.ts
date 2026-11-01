"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkBotCredentials, GUID } from "@/lib/channels/teams-api";
import { can, loadWorkspace } from "@/lib/workspace";

/**
 * Connecting Microsoft Teams as an internal help desk (decided 2026-11-02): each company registers its own Azure Bot and
 * pastes its Application (client) ID, a client secret and its Directory (tenant) ID. They are checked with Microsoft first
 * (a token is requested), then the secret is stored in Vault by the database. Relay then shows the messaging endpoint to
 * set on the Azure Bot and generates the Teams app file to upload.
 */

export type TeamsError = "needAppId" | "needTenant" | "needSecret" | "tooLong" | "badCredentials" | "unreachable" | "already" | "otherAccount" | "notAllowed" | "needName" | "failed";
export type TeamsState = { error: TeamsError; detail?: string } | null;

const secretSchema = z.string().trim().min(8).max(200).regex(/^\S+$/);
const why = (message: string): TeamsError => (message.includes("not_allowed") ? "notAllowed" : message.includes("need_name") ? "needName" : message.includes("already_connected") ? "otherAccount" : "failed");
const MAX_GREETING = 500;

export async function connectTeams(_prev: TeamsState, data: FormData): Promise<TeamsState> {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const appId = String(data.get("appId") ?? "").trim().toLowerCase();
  const tenant = String(data.get("tenant") ?? "").trim().toLowerCase();
  const secret = secretSchema.safeParse(data.get("secret"));
  const greeting = String(data.get("greeting") ?? "").trim();
  const name = String(data.get("name") ?? "").trim() || "Help desk";
  if (!GUID.test(appId)) return { error: "needAppId" };
  if (!GUID.test(tenant)) return { error: "needTenant" };
  if (!secret.success) return { error: "needSecret" };
  if (greeting.length > MAX_GREETING) return { error: "tooLong" };

  const check = await checkBotCredentials(fetch, appId, secret.data, tenant);
  if (!check.ok) return { error: check.reason === "unreachable" ? "unreachable" : "badCredentials", ...(check.reason === "rejected" && check.description ? { detail: check.description } : {}) };

  const settings = { app_id: appId, tenant_id: tenant, greeting };
  const secrets = { client_secret: secret.data };
  // The same bot connected earlier and then disconnected is brought back; one that is live is refused.
  const { data: existing } = await supabase.from("channels").select("id, status").eq("workspace_id", workspace.id).eq("type", "teams").eq("external_id", appId).maybeSingle();
  let id: string;
  if (existing) {
    if (existing.status !== "disconnected") return { error: "already" };
    const { error } = await supabase.rpc("update_channel_credentials", { p_channel: existing.id, p_settings: settings, p_secrets: secrets, p_name: name });
    if (error) return { error: why(error.message) };
    id = existing.id;
  } else {
    const { data: made, error } = await supabase.rpc("connect_channel", { p_workspace: workspace.id, p_type: "teams", p_name: name, p_external_id: appId, p_settings: settings, p_secrets: secrets });
    if (error) return { error: why(error.message) };
    id = (made as { id: string }).id;
  }
  redirect(`/w/${slug}/channels/${id}?created=1`);
}

/** The name shown in the inbox and in Teams, and the greeting. Never changes whether it is connected. */
export async function updateTeams(_prev: TeamsState, data: FormData): Promise<TeamsState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const name = String(data.get("name") ?? "").trim();
  const greeting = String(data.get("greeting") ?? "").trim();
  if (!name) return { error: "needName" };
  if (greeting.length > MAX_GREETING) return { error: "tooLong" };
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: { greeting }, p_secrets: {}, p_name: name });
  if (error) return { error: why(error.message) };
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** A new client secret for the same bot (secrets expire, so this will happen). */
export async function replaceTeamsSecret(_prev: TeamsState, data: FormData): Promise<TeamsState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return { error: "notAllowed" };
  const secret = secretSchema.safeParse(data.get("secret"));
  if (!secret.success) return { error: "needSecret" };
  const { data: ch } = await supabase.from("channels").select("id, settings").eq("id", id).eq("type", "teams").maybeSingle();
  const s = (ch?.settings ?? {}) as { app_id?: string; tenant_id?: string };
  if (!ch || !s.app_id || !s.tenant_id) return { error: "failed" };
  const check = await checkBotCredentials(fetch, s.app_id, secret.data, s.tenant_id);
  if (!check.ok) return { error: check.reason === "unreachable" ? "unreachable" : "badCredentials", ...(check.reason === "rejected" && check.description ? { detail: check.description } : {}) };
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: {}, p_secrets: { client_secret: secret.data } });
  if (error) return { error: why(error.message) };
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** Marks the bot disconnected. The company also removes the bot and the app in Azure and Teams (Relay can't do that). */
export async function disconnectTeams(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("disconnect_channel", { p_channel: id });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels?add=1`);
}
