"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadWorkspace } from "@/lib/workspace";
import { checkDomain, DomainError, startDomain, type DomainState } from "@/lib/email/postmark-domains";

/** Email channel setup (decided 2026-10-19). The database checks the person may manage channels. */
const form = z.object({
  name: z.string().trim().min(1, "needName").max(80, "needName"),
  address: z.string().trim().toLowerCase().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "badAddress"),
  fromName: z.string().trim().max(80).optional(),
  signature: z.string().trim().max(1000).optional(),
});

const read = (data: FormData) =>
  form.safeParse({
    name: data.get("name"),
    address: data.get("address"),
    fromName: data.get("fromName") ?? undefined,
    signature: data.get("signature") ?? undefined,
  });

const reason = (message: string) => (message.includes("not_allowed") ? "notAllowed" : message.includes("bad_address") ? "badAddress" : "failed");

export async function createEmailChannel(data: FormData) {
  const slug = String(data.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const f = read(data);
  if (!f.success) redirect(`/w/${slug}/channels/new/email?error=${f.error.issues[0]!.message}`);
  const { data: id, error } = await supabase.rpc("create_email_channel", {
    p_workspace: workspace.id, p_name: f.data.name, p_address: f.data.address, p_from_name: f.data.fromName ?? null, p_signature: f.data.signature ?? null,
  });
  if (error) redirect(`/w/${slug}/channels/new/email?error=${reason(error.message)}`);
  redirect(`/w/${slug}/channels/${id}?created=1`);
}

export async function updateEmailChannel(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase } = await loadWorkspace(slug);
  const f = read(data);
  if (!f.success) redirect(`/w/${slug}/channels/${id}?error=${f.error.issues[0]!.message}`);
  const { error } = await supabase.rpc("update_email_channel", {
    p_channel: id, p_name: f.data.name, p_address: f.data.address, p_from_name: f.data.fromName ?? null, p_signature: f.data.signature ?? null,
  });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${reason(error.message)}`);
  redirect(`/w/${slug}/channels/${id}?saved=1`);
}

/** Starts or re-checks verification of the business's domain, so replies can come from its own address. */
export async function verifyEmailDomain(data: FormData) {
  const slug = String(data.get("slug"));
  const id = z.uuid().parse(data.get("id"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const { data: ch } = await supabase.from("channels").select("settings").eq("id", id).eq("workspace_id", workspace.id).eq("type", "email").maybeSingle();
  const settings = (ch?.settings ?? {}) as { address?: string; domain?: { id: number; name: string } };
  const name = (settings.address ?? "").split("@")[1];
  if (!name) redirect(`/w/${slug}/channels/${id}?error=badAddress`);

  let state: DomainState;
  try {
    // A changed address means a different domain: start again for it.
    state = settings.domain?.id && settings.domain.name === name ? await checkDomain(settings.domain.id) : await startDomain(name);
  } catch (e) {
    redirect(`/w/${slug}/channels/${id}?error=${e instanceof DomainError && e.message === "notConfigured" ? "domainNotConfigured" : "domainFailed"}`);
  }
  const { error } = await supabase.rpc("set_email_domain", { p_channel: id, p_domain: state });
  if (error) redirect(`/w/${slug}/channels/${id}?error=${reason(error.message)}`);
  redirect(`/w/${slug}/channels/${id}?${state.verified ? "verified=1" : "checked=1"}`);
}
