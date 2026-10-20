"use server";

import { z } from "zod";
import type { ContactPatch } from "@/components/customers/save";
import { loadWorkspace } from "@/lib/workspace";

/**
 * Saving customers and companies (step 2b, decided 2026-10-20). The database checks every permission again;
 * these only shape the input and turn refusals into short error keys the screens word in plain language.
 */

const key = (message: string) =>
  ["not_allowed", "bad_email", "bad_phone", "need_name", "need_reach", "domain_taken", "bad_domain", "too_long"].find((k) => message.includes(k)) ?? "failed";

export async function addCustomer(slug: string, draft: { name: string; email: string; phone: string; company: string; tag: string }) {
  const { supabase, workspace } = await loadWorkspace(slug);
  let company: string | null = null;
  const companyName = draft.company.trim();
  if (companyName) {
    // An existing company with that name, or a new one.
    const { data: found } = await supabase.from("companies").select("id").eq("workspace_id", workspace.id).ilike("name", companyName).maybeSingle();
    if (found) company = found.id;
    else {
      const { data: made, error } = await supabase.rpc("save_company", { p_workspace: workspace.id, p_company: null, p_data: { name: companyName } });
      if (error) return { error: key(error.message) };
      company = made;
    }
  }
  const { data: id, error } = await supabase.rpc("create_contact", {
    p_workspace: workspace.id, p_name: draft.name, p_email: draft.email || null, p_phone: draft.phone || null, p_company: company,
  });
  if (error) return { error: key(error.message) };
  if (draft.tag) await supabase.rpc("update_contact", { p_contact: id, p_patch: { tags: [draft.tag] } });
  return { id: id as string };
}

export async function bulkCustomers(slug: string, kind: "tag" | "owner" | "stage", ids: string[], value: string) {
  const { supabase } = await loadWorkspace(slug);
  const list = z.array(z.uuid()).max(500).parse(ids);
  for (const id of list) {
    let patch: ContactPatch;
    if (kind === "tag") {
      const { data } = await supabase.from("contacts").select("tags").eq("id", id).maybeSingle();
      patch = { tags: [...new Set([...(data?.tags ?? []), value.trim()])] };
    } else patch = kind === "owner" ? { owner: value } : { lifecycle: value };
    const { error } = await supabase.rpc("update_contact", { p_contact: id, p_patch: patch });
    if (error) return key(error.message);
  }
  return null;
}

export async function patchCustomer(slug: string, id: string, patch: ContactPatch) {
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("update_contact", { p_contact: z.uuid().parse(id), p_patch: patch });
  return error ? key(error.message) : null;
}

export async function pinCustomerNote(slug: string, id: string, text: string) {
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("pin_contact_note", { p_contact: z.uuid().parse(id), p_text: text });
  return error ? key(error.message) : null;
}

export async function saveCompany(slug: string, id: string | null, data: { name: string; domain?: string; industry?: string; size?: string; location?: string }) {
  const { supabase, workspace } = await loadWorkspace(slug);
  const { data: saved, error } = await supabase.rpc("save_company", { p_workspace: workspace.id, p_company: id, p_data: data });
  return error ? { error: key(error.message) } : { id: saved as string };
}

export async function saveContactFields(slug: string, defs: { key: string; label: string; type: string; options?: string[] }[]) {
  const { supabase, workspace } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("save_contact_fields", { p_workspace: workspace.id, p_defs: defs });
  return error ? key(error.message) : null;
}

export async function saveLabel(slug: string, id: string | null, name: string, color: string) {
  const { supabase, workspace } = await loadWorkspace(slug);
  const { data, error } = await supabase.rpc("save_label", { p_workspace: workspace.id, p_label: id, p_name: name, p_color: color });
  return error ? { error: error.message.includes("name_taken") ? "name_taken" : key(error.message) } : { id: data as string };
}

export async function deleteLabel(slug: string, id: string) {
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.rpc("delete_label", { p_label: z.uuid().parse(id) });
  return error ? key(error.message) : null;
}
