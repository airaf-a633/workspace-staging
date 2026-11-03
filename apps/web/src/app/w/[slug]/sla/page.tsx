import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { SlaSettingsPage } from "@/components/sla/sla-settings";
import { getT } from "@/i18n/server";
import { loadSlaSettings } from "@/lib/sla-live";
import { can, loadWorkspace } from "@/lib/workspace";
import { addClosure, deletePolicy, removeClosure, saveAlerts, saveHours, savePolicy } from "./actions";

export async function generateMetadata() {
  return { title: (await getT("settings"))("sla") };
}

/**
 * Settings › Reply targets on real data (decided 2026-11-03). Everyone in the workspace can see how reply targets are set; changing
 * them needs "Teams, hours, routing rules": the owner changes everything, a team manager their own teams' hours and the rules that
 * name only those teams. The database checks the same thing again on every save.
 */
export default async function SlaPage(props: PageProps<"/w/[slug]/sla">) {
  const { slug } = await props.params;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const [{ data: teams }, { data: mine }, { data: scope }, t] = await Promise.all([
    supabase.from("teams").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("team_members").select("team_id").eq("workspace_id", workspace.id).eq("member_id", me.id),
    supabase.rpc("permission_scope", { p_workspace: workspace.id, p_permission: "teams.manage" }),
    getT("slaSettings"),
  ]);
  const rows = teams ?? [];
  const initial = await loadSlaSettings(supabase, workspace.id, workspace.timezone || "UTC", rows.map((x) => x.id));
  const editable = { all: scope === "all", teams: scope === "team" ? (mine ?? []).map((x) => x.team_id) : [] };
  const actions = {
    saveHours: saveHours.bind(null, slug),
    addClosure: addClosure.bind(null, slug),
    removeClosure: removeClosure.bind(null, slug),
    savePolicy: savePolicy.bind(null, slug),
    deletePolicy: deletePolicy.bind(null, slug),
    saveAlerts: saveAlerts.bind(null, slug),
  };
  return (
    <SettingsFrame base={`/w/${slug}`} active="sla" isOwner={await can(workspace.id, "members.manage")}>
      <SectionHeader title={t("title")} description={t("description")} />
      <SlaSettingsPage initial={initial} teams={rows} editable={editable} actions={actions} />
    </SettingsFrame>
  );
}
