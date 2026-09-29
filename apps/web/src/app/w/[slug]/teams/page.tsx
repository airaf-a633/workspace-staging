import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Submit } from "@/components/ui/button";
import { Checkbox, SelectInput, TextInput } from "@/components/ui/field";
import { Badge, Card, Notice, PageHeader } from "@/components/ui/surface";
import { can, loadWorkspace } from "@/lib/workspace";
import { createTeam, deleteTeam, setTeamMember, updateTeam } from "./actions";

export default async function Teams(props: PageProps<"/w/[slug]/teams">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace } = await loadWorkspace(slug);
  const isOwner = await can(workspace.id, "members.manage");
  const { data: scope } = await supabase.rpc("permission_scope", { p_workspace: workspace.id, p_permission: "teams.manage" });

  const [{ data: teams }, { data: members }, { data: links }, { data: mine }] = await Promise.all([
    supabase.from("teams").select("id, name, is_branch, is_default").eq("workspace_id", workspace.id).order("name"),
    supabase.from("members").select("id, display_name").eq("workspace_id", workspace.id).eq("status", "active").order("display_name"),
    supabase.from("team_members").select("team_id, member_id").eq("workspace_id", workspace.id),
    supabase.rpc("member_id", { p_workspace: workspace.id }),
  ]);
  const myTeams = new Set(links?.filter((l) => l.member_id === mine).map((l) => l.team_id));
  const canEdit = (teamId: string) => scope === "all" || (scope === "team" && myTeams.has(teamId));

  return (
    <>
      <PageHeader title="Teams and branches" description="A branch is a team with its own location. Conversations, reply targets and routing are set per team." />
      {typeof sp.error === "string" && <Notice tone="error" title={sp.error} />}

      {teams?.map((t) => {
        const inTeam = new Set(links?.filter((l) => l.team_id === t.id).map((l) => l.member_id));
        const people = members?.filter((m) => inTeam.has(m.id)) ?? [];
        const others = members?.filter((m) => !inTeam.has(m.id)) ?? [];
        return (
          <Card
            key={t.id}
            title={<span className="flex flex-wrap items-center gap-2">{t.name}{t.is_branch && <Badge tone="transit">Branch</Badge>}{t.is_default && <Badge>Default</Badge>}</span>}
            description={`${people.length} ${people.length === 1 ? "person" : "people"}`}
          >
            {people.length > 0 ? (
              <ul className="divide-y divide-border">
                {people.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <span>{m.display_name}</span>
                    {isOwner && (
                      <form action={setTeamMember}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="teamId" value={t.id} />
                        <input type="hidden" name="memberId" value={m.id} />
                        <input type="hidden" name="op" value="remove" />
                        <Submit variant="ghost" size="sm" pending="Removing…">Remove from team</Submit>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Nobody in this team yet.</p>
            )}

            {(isOwner || canEdit(t.id)) && (
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
                  Edit team <CaretDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="mt-2 grid gap-5 rounded-[var(--radius-control)] bg-surface-2 p-4">
                  {isOwner && others.length > 0 && (
                    <form action={setTeamMember} className="grid gap-3 sm:max-w-sm">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="teamId" value={t.id} />
                      <SelectInput label="Add someone" name="memberId">
                        {others.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                      </SelectInput>
                      <Submit variant="secondary" pending="Adding…">Add to team</Submit>
                    </form>
                  )}
                  {canEdit(t.id) && (
                    <form action={updateTeam} className="grid gap-3 sm:max-w-sm">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="teamId" value={t.id} />
                      <TextInput label="Team name" name="name" defaultValue={t.name} required />
                      <Checkbox name="isBranch" defaultChecked={t.is_branch} label="This team is a branch" />
                      <Submit variant="secondary">Save team</Submit>
                    </form>
                  )}
                  {isOwner && !t.is_default && (
                    <details className="border-t border-border pt-3">
                      <summary className="min-h-11 cursor-pointer list-none text-sm font-medium text-fail [&::-webkit-details-marker]:hidden">Delete team…</summary>
                      <form action={deleteTeam} className="mt-2 grid gap-2 sm:max-w-sm">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="teamId" value={t.id} />
                        <p className="text-sm">People stay in the workspace; they just leave this team.</p>
                        <Submit variant="destructive" pending="Deleting…">Delete {t.name}</Submit>
                      </form>
                    </details>
                  )}
                </div>
              </details>
            )}
          </Card>
        );
      })}

      {scope === "all" && (
        <Card title="New team">
          <form action={createTeam} className="grid gap-3 sm:max-w-sm">
            <input type="hidden" name="slug" value={slug} />
            <TextInput label="Team name" name="name" placeholder="e.g. Dubai Mall shop" required />
            <Checkbox name="isBranch" label="This team is a branch" />
            <Submit pending="Creating…">Create team</Submit>
          </form>
        </Card>
      )}
    </>
  );
}
