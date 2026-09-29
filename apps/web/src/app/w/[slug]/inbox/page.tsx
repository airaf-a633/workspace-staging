import { Suspense } from "react";
import { CONVERSATION_PERMISSIONS, type ConversationPermission, type Scope } from "@app/domain";
import { Inbox } from "@/components/inbox/inbox";
import { buildSampleInbox } from "@/components/inbox/sample-data";
import { loadWorkspace } from "@/lib/workspace";

export const metadata = { title: "Inbox" };

type Scopes = Partial<Record<ConversationPermission, Scope>>;
const ALL: Scopes = Object.fromEntries(CONVERSATION_PERMISSIONS.map((k) => [k, "all"]));

export default async function InboxPage(props: PageProps<"/w/[slug]/inbox">) {
  const { slug } = await props.params;
  const { supabase, workspace, me } = await loadWorkspace(slug);

  const [{ data: teams }, { data: members }, { data: links }, { data: perms }] = await Promise.all([
    supabase.from("teams").select("id, name, is_default").eq("workspace_id", workspace.id).order("name"),
    supabase.from("members").select("id, display_name, role_id, roles(name, is_owner)").eq("workspace_id", workspace.id).eq("status", "active").order("display_name"),
    supabase.from("team_members").select("team_id, member_id").eq("workspace_id", workspace.id),
    supabase.from("role_permissions").select("role_id, permission, scope").eq("workspace_id", workspace.id).in("permission", [...CONVERSATION_PERMISSIONS]),
  ]);

  // Everyone's scopes, from the same role data the database checks. The owner role holds every permission.
  const scopesFor = (roleId: string, isOwner: boolean): Scopes =>
    isOwner ? ALL : Object.fromEntries((perms ?? []).filter((p) => p.role_id === roleId).map((p) => [p.permission, p.scope as Scope]));

  const real = (members ?? []).map((m) => {
    const role = Array.isArray(m.roles) ? m.roles[0] : m.roles;
    const scopes = scopesFor(m.role_id, !!role?.is_owner);
    return { id: m.id, name: m.display_name, role: role?.name ?? "", canReply: (scopes["conversations.reply"] ?? "none") !== "none", scopes };
  });
  const mine = real.find((m) => m.id === me.id)!;

  const data = buildSampleInbox(
    real,
    (teams ?? []).map((t) => ({ id: t.id, name: t.name, isDefault: t.is_default })),
    { memberId: me.id, teamIds: (links ?? []).filter((l) => l.member_id === me.id).map((l) => l.team_id), scopes: mine.scopes },
  );

  return (
    <Suspense>
      <Inbox data={data} />
    </Suspense>
  );
}
