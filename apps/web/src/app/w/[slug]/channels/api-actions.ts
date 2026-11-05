"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appOrigin } from "@/lib/app-origin";
import { loadWorkspace } from "@/lib/workspace";

/**
 * API inboxes (decided 2026-11-01). The API key is made here, shown once, and only its fingerprint is kept; the
 * signing secret for replies is kept in Vault (it is needed to sign) and shown once too. The database checks that
 * the person may manage channels.
 */

export interface ApiRevealed {
  id: string;
  endpoint: string;
  apiKey: string;
  webhookSecret?: string;
}
export type ApiState = { error?: "needName" | "needHttps" | "notAllowed" | "failed"; revealed?: ApiRevealed } | null;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const newKey = () => `rly_${randomBytes(24).toString("base64url")}`;
const newSecret = () => `whsec_${randomBytes(24).toString("base64url")}`;

const form = z.object({
  name: z.string().trim().min(1, "needName").max(80, "needName"),
  webhook: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "needHttps"),
});

function fields(data: FormData) {
  const parsed = form.safeParse({ name: data.get("name"), webhook: data.get("webhook") ?? "" });
  return parsed.success ? ({ ok: parsed.data } as const) : ({ error: parsed.error.issues[0]!.message as "needName" | "needHttps" } as const);
}

const why = (message: string) => (message.includes("not_allowed") ? "notAllowed" : message.includes("need_name") ? "needName" : "failed") as "notAllowed" | "needName" | "failed";

export async function createApiInbox(_prev: ApiState, data: FormData): Promise<ApiState> {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const f = fields(data);
  if ("error" in f) return { error: f.error };
  const apiKey = newKey();
  const webhookSecret = newSecret();
  const { data: made, error } = await supabase.rpc("connect_channel", {
    p_workspace: workspace.id,
    p_type: "api",
    p_name: f.ok.name,
    p_external_id: null,
    p_settings: { webhook_url: f.ok.webhook },
    p_secrets: { api_key_hash: sha256(apiKey), webhook_secret: webhookSecret },
  });
  if (error) return { error: why(error.message) };
  const { id, key } = made as { id: string; key: string };
  return { revealed: { id, apiKey, webhookSecret, endpoint: `${await appOrigin()}/api/v1/inboxes/${key}/messages` } };
}

/** A new key: the old one stops working at once. */
export async function rotateApiKey(_prev: ApiState, data: FormData): Promise<ApiState> {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const { data: ch } = await supabase.from("channels").select("settings").eq("id", id).eq("type", "api").maybeSingle();
  if (!ch) return { error: "failed" };
  const apiKey = newKey();
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: {}, p_secrets: { api_key_hash: sha256(apiKey) } });
  if (error) return { error: why(error.message) };
  const key = (ch.settings as { webhook_key?: string }).webhook_key ?? "";
  return { revealed: { id, apiKey, endpoint: `${await appOrigin()}/api/v1/inboxes/${key}/messages` } };
}

export async function updateApiInbox(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const f = fields(data);
  if ("error" in f) redirect(`/w/${slug}/channels/${id}?error=${f.error}`);
  const { error } = await supabase.rpc("update_channel_credentials", { p_channel: id, p_settings: { webhook_url: f.ok.webhook }, p_secrets: {}, p_name: f.ok.name });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${why(error.message)}`);
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}
