import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Submit } from "@/components/ui/submit";
import { Checkbox, SelectInput, TextInput } from "@/components/ui/field";
import { Badge, Notice } from "@/components/ui/surface";
import { buttonClass } from "@/components/ui/button";
import { ListSurface, SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { can, loadWorkspace } from "@/lib/workspace";
import { createTeam, deleteTeam, setTeamMember, updateTeam } from "./actions";
import { errorText } from "@/i18n/labels";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("settings"))("teams") };
}

export default async function Teams(props: PageProps<"/w/[slug]/teams">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace } = await loadWorkspace(slug);
  const isOwner = await can(workspace.id, "members.manage");
  const { data: scope } = await supabase.rpc("permission_scope", { p_workspace: workspace.id, p_permission: "teams.manage" });
  const creating = scope === "all" && sp.new === "1";

  const [{ data: teams }, { data: members }, { data: links }, { data: mine }] = await Promise.all([
    supabase.from("teams").select("id, name, is_branch, is_default").eq("workspace_id", workspace.id).order("name"),
    supabase.from("members").select("id, display_name").eq("workspace_id", workspace.id).eq("status", "active").order("display_name"),
    supabase.from("team_members").select("team_id, member_id").eq("workspace_id", workspace.id),
    supabase.rpc("member_id", { p_workspace: workspace.id }),
  ]);
  const myTeams = new Set(links?.filter((l) => l.member_id === mine).map((l) => l.team_id));
  const canEdit = (teamId: string) => scope === "all" || (scope === "team" && myTeams.has(teamId));
  const base = `/w/${slug}`;
  const t = await getT("teamsPage");
  const tAll = await getT();
  const error = errorText(tAll, "teamsPage", sp.error);

  return (
    <SettingsFrame base={base} active="teams" isOwner={isOwner}>
      <SectionHeader
        title={t("title")}
        description={t("description")}
        action={scope === "all" && !creating ? <Link href="?new=1" className={buttonClass("primary", "sm")}>{t("new")}</Link> : undefined}
      />
      {error && <Notice tone="error" title={error} />}

      {creating && (
        <form action={createTeam} className="grid gap-4 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-2)] ring-1 ring-border sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="slug" value={slug} />
          <TextInput label={t("name")} name="name" placeholder={t("namePlaceholder")} required autoFocus />
          <Checkbox name="isBranch" label={t("isBranch")} />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Link href={`${base}/teams`} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</Link>
            <Submit size="sm" pending={tAll("onboarding.creating")}>{t("create")}</Submit>
          </div>
        </form>
      )}

      <ListSurface>
        {teams?.map((team) => {
          const inTeam = new Set(links?.filter((l) => l.team_id === team.id).map((l) => l.member_id));
          const people = members?.filter((m) => inTeam.has(m.id)) ?? [];
          const others = members?.filter((m) => !inTeam.has(m.id)) ?? [];
          return (
            <li key={team.id} className="grid gap-3 border-b border-border px-5 py-4 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {team.name}
                  {team.is_branch && <Badge tone="transit">{t("branch")}</Badge>}
                  {team.is_default && <Badge>{t("default")}</Badge>}
                </p>
                <span className="text-sm text-muted">{t("people", { count: people.length })}</span>
              </div>
              {people.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {people.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 ps-1 pe-2 text-sm">
                      <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary" aria-hidden="true">{m.display_name.charAt(0).toUpperCase()}</span>
                      {m.display_name}
                      {isOwner && (
                        <form action={setTeamMember}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="teamId" value={team.id} />
                          <input type="hidden" name="memberId" value={m.id} />
                          <input type="hidden" name="op" value="remove" />
                          <button type="submit" className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface hover:text-fail" aria-label={t("removeFrom", { name: m.display_name, team: team.name })} title={t("removeTitle")}>
                            ×
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t("empty")}</p>
              )}

              {(isOwner || canEdit(team.id)) && (
                <details className="group">
                  <summary className="flex min-h-9 w-fit cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
                    {t("edit", { name: team.name })} <CaretDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="mt-2 grid gap-5 rounded-[var(--radius-control)] bg-surface-2 p-4 sm:grid-cols-2">
                    {isOwner && others.length > 0 && (
                      <form action={setTeamMember} className="grid content-start gap-3">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="teamId" value={team.id} />
                        <SelectInput label={t("addSomeone")} name="memberId">
                          {others.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                        </SelectInput>
                        <Submit variant="secondary" size="sm" pending={t("adding")}>{t("addToTeam")}</Submit>
                      </form>
                    )}
                    {canEdit(team.id) && (
                      <form action={updateTeam} className="grid content-start gap-3">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="teamId" value={team.id} />
                        <TextInput label={t("name")} name="name" defaultValue={team.name} required />
                        <Checkbox name="isBranch" defaultChecked={team.is_branch} label={t("isBranch")} />
                        <Submit variant="secondary" size="sm">{t("save")}</Submit>
                      </form>
                    )}
                    {isOwner && !team.is_default && (
                      <details className="border-t border-border pt-3 sm:col-span-2">
                        <summary className="min-h-9 w-fit cursor-pointer list-none text-sm font-medium text-fail [&::-webkit-details-marker]:hidden">{t("deleteMenu")}</summary>
                        <form action={deleteTeam} className="mt-2 grid gap-2 sm:max-w-sm">
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="teamId" value={team.id} />
                          <p className="text-sm">{t("deleteBody")}</p>
                          <Submit variant="destructive" size="sm" pending={t("deleting")}>{t("delete", { name: team.name })}</Submit>
                        </form>
                      </details>
                    )}
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ListSurface>
    </SettingsFrame>
  );
}
