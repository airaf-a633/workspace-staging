import { Field, Notice, Page, Submit } from "@/components/plain";
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
    <Page title="Teams and branches">
      {typeof sp.error === "string" && <Notice tone="error">{sp.error}</Notice>}
      <p className="text-sm">A branch is a team with its own location. Conversations, reply targets and routing are set per team.</p>

      {teams?.map((t) => {
        const inTeam = new Set(links?.filter((l) => l.team_id === t.id).map((l) => l.member_id));
        return (
          <section key={t.id} className="grid gap-3 border-t pt-4">
            <h2 className="text-lg font-semibold">
              {t.name} {t.is_branch && <span className="text-sm font-normal">(branch)</span>} {t.is_default && <span className="text-sm font-normal">(default team)</span>}
            </h2>
            <ul className="grid gap-1 text-sm">
              {members?.filter((m) => inTeam.has(m.id)).map((m) => (
                <li key={m.id} className="flex justify-between gap-4">
                  {m.display_name}
                  {isOwner && (
                    <form action={setTeamMember}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="teamId" value={t.id} />
                      <input type="hidden" name="memberId" value={m.id} />
                      <input type="hidden" name="op" value="remove" />
                      <button type="submit" className="underline">Remove from team</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {isOwner && (
              <form action={setTeamMember} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="teamId" value={t.id} />
                <label className="grid gap-1 text-sm">
                  Add someone
                  <select name="memberId" className="rounded border border-slate-500 px-2 py-1">
                    {members?.filter((m) => !inTeam.has(m.id)).map((m) => (
                      <option key={m.id} value={m.id}>{m.display_name}</option>
                    ))}
                  </select>
                </label>
                <Submit variant="secondary">Add</Submit>
              </form>
            )}
            {canEdit(t.id) && (
              <form action={updateTeam} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="teamId" value={t.id} />
                <Field label="Team name" name="name" defaultValue={t.name} required />
                <label className="flex gap-2 text-sm"><input type="checkbox" name="isBranch" defaultChecked={t.is_branch} /> Branch</label>
                <Submit variant="secondary">Save</Submit>
              </form>
            )}
            {isOwner && !t.is_default && (
              <form action={deleteTeam}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="teamId" value={t.id} />
                <button type="submit" className="text-sm underline">Delete team</button>
              </form>
            )}
          </section>
        );
      })}

      {scope === "all" && (
        <form action={createTeam} className="grid gap-3 border-t pt-4">
          <input type="hidden" name="slug" value={slug} />
          <Field label="New team name" name="name" required />
          <label className="flex gap-2 text-sm"><input type="checkbox" name="isBranch" /> This team is a branch</label>
          <Submit>Create team</Submit>
        </form>
      )}
    </Page>
  );
}
