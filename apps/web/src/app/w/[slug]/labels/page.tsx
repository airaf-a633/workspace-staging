import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { LabelsSettingsLive } from "@/components/settings-live";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("settings"))("labels") };
}

/* Settings › Labels on real data (step 2b): owners and admins (crm.settings) manage them. */
export default async function Labels(props: PageProps<"/w/[slug]/labels">) {
  const { slug } = await props.params;
  const { supabase, workspace } = await loadWorkspace(slug);
  const t = await getT("labelsSettings");
  const [{ data: labels }, { data: used }] = await Promise.all([
    supabase.from("labels").select("id, name, color").eq("workspace_id", workspace.id).order("name"),
    supabase.from("conversation_labels").select("label_id").eq("workspace_id", workspace.id),
  ]);
  const usage: Record<string, number> = {};
  for (const u of used ?? []) usage[u.label_id] = (usage[u.label_id] ?? 0) + 1;
  return (
    <SettingsFrame base={`/w/${slug}`} active="labels" isOwner={await can(workspace.id, "members.manage")}>
      <SectionHeader title={t("title")} description={t("description")} />
      <LabelsSettingsLive slug={slug} initial={labels ?? []} usage={usage} canEdit={await can(workspace.id, "crm.settings")} />
    </SettingsFrame>
  );
}
