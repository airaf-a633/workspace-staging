"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadWorkspace } from "@/lib/workspace";

const SCOPES = ["none", "own", "team", "all"] as const;

function back(slug: string, path: string, msg: string): never {
  redirect(`/w/${slug}/${path}?error=${encodeURIComponent(msg)}`);
}

export async function createRole(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const parsed = z
    .object({ name: z.string().trim().min(1, "Name the role.").max(60), from: z.enum(["sales_manager", "support_manager", "ops_manager", "agent", "viewer"]) })
    .safeParse({ name: form.get("name"), from: form.get("from") });
  if (!parsed.success) back(slug, "roles", parsed.error.issues[0]!.message);
  const { data, error } = await supabase.rpc("create_custom_role", { p_workspace: workspace.id, p_name: parsed.data.name, p_from_template: parsed.data.from });
  if (error) back(slug, "roles", "Only the owner can create roles.");
  redirect(`/w/${slug}/roles/${data}`);
}

export async function saveRolePermissions(form: FormData) {
  const slug = String(form.get("slug"));
  const roleId = z.uuid().parse(form.get("roleId"));
  const { supabase } = await loadWorkspace(slug);

  const name = z.string().trim().min(1).max(60).safeParse(form.get("name"));
  if (!name.success) back(slug, `roles/${roleId}`, "Name the role.");
  const { error: nameError } = await supabase.from("roles").update({ name: name.data }).eq("id", roleId);
  if (nameError) back(slug, `roles/${roleId}`, "Only custom roles can be changed, and only by the owner.");

  const changes = [...form.entries()]
    .filter(([k]) => k.startsWith("perm:"))
    .map(([k, v]) => ({ permission: k.slice(5), scope: z.enum(SCOPES).parse(v) }));
  for (const c of changes) {
    const { error } = await supabase.from("role_permissions").update({ scope: c.scope }).eq("role_id", roleId).eq("permission", c.permission);
    if (error) back(slug, `roles/${roleId}`, error.code === "42501" ? `${c.permission} is owner-only.` : "Couldn't save. Try again.");
  }
  redirect(`/w/${slug}/roles/${roleId}?saved=1`);
}

export async function deleteRole(form: FormData) {
  const slug = String(form.get("slug"));
  const roleId = z.uuid().parse(form.get("roleId"));
  const { supabase } = await loadWorkspace(slug);
  const { error } = await supabase.from("roles").delete().eq("id", roleId);
  if (error) back(slug, `roles/${roleId}`, error.code === "23503" ? "Move the members using this role to another role first." : "Only custom roles can be deleted.");
  redirect(`/w/${slug}/roles`);
}
