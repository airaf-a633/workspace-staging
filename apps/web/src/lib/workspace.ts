import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Loads a workspace the signed-in user belongs to, plus their own member row and role.
 * Row-level security returns nothing for workspaces they aren't in, which becomes a 404
 * (so outsiders can't tell whether a workspace exists).
 */
export async function loadWorkspace(slug: string) {
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/w/${slug}`)}`);
  const supabase = await createClient();
  const { data: workspace } = await supabase.from("workspaces").select("id, name, slug, timezone").eq("slug", slug).maybeSingle();
  if (!workspace) notFound();
  const { data: me } = await supabase
    .from("members")
    .select("id, display_name, role_id, roles(key, name, is_owner)")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!me) notFound();
  return { supabase, user, workspace, me };
}

export async function can(workspaceId: string, permission: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_permission", { p_workspace: workspaceId, p_permission: permission });
  return data === true;
}
