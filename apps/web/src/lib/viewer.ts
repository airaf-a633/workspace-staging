import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONVERSATION_PERMISSIONS, type ConversationPermission, type Scope } from "@app/domain";

/**
 * Who's looking, and what everyone may do: active members with their role scopes, the teams, and the viewer's own
 * teams and scopes. Built from the same role data the database checks. Shared by the inbox and Contacts pages.
 */
type Scopes = Partial<Record<ConversationPermission, Scope>>;
const ALL: Scopes = Object.fromEntries(CONVERSATION_PERMISSIONS.map((k) => [k, "all"]));

export async function loadPeople(supabase: SupabaseClient, workspaceId: string, meId: string) {
  const [{ data: teams }, { data: members }, { data: links }, { data: perms }] = await Promise.all([
    supabase.from("teams").select("id, name, is_default").eq("workspace_id", workspaceId).order("name"),
    supabase.from("members").select("id, display_name, role_id, roles(name, is_owner)").eq("workspace_id", workspaceId).eq("status", "active").order("display_name"),
    supabase.from("team_members").select("team_id, member_id").eq("workspace_id", workspaceId),
    supabase.from("role_permissions").select("role_id, permission, scope").eq("workspace_id", workspaceId).in("permission", [...CONVERSATION_PERMISSIONS]),
  ]);
  // The owner role holds every permission.
  const scopesFor = (roleId: string, isOwner: boolean): Scopes =>
    isOwner ? ALL : Object.fromEntries((perms ?? []).filter((p) => p.role_id === roleId).map((p) => [p.permission, p.scope as Scope]));
  const people = (members ?? []).map((m) => {
    const role = Array.isArray(m.roles) ? m.roles[0] : m.roles;
    const scopes = scopesFor(m.role_id, !!role?.is_owner);
    return { id: m.id as string, name: m.display_name as string, role: (role?.name as string) ?? "", canReply: (scopes["conversations.reply"] ?? "none") !== "none", scopes };
  });
  const me = people.find((p) => p.id === meId);
  return {
    people,
    teams: (teams ?? []).map((t) => ({ id: t.id as string, name: t.name as string, isDefault: !!t.is_default })),
    viewer: { memberId: meId, teamIds: (links ?? []).filter((l) => l.member_id === meId).map((l) => l.team_id as string), scopes: me?.scopes ?? {} },
  };
}
