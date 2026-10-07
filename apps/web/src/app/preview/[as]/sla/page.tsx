import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { SlaSettingsPage } from "@/components/sla/sla-settings";
import { getT, getTimeZone } from "@/i18n/server";
import { PREVIEW_TEAMS, previewInbox, previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("settings"))("sla") };
}

export default async function PreviewSla(props: PageProps<"/preview/[as]/sla">) {
  const { as } = await props.params;
  const t = await getT("slaSettings");
  const data = previewInbox(as, await getTimeZone());
  return (
    <SettingsFrame base={`/preview/${as}`} active="sla" isOwner={previewScope(as, "members.manage") !== "none"}>
      <SectionHeader title={t("title")} description={t("description")} />
      <SlaSettingsPage initial={data.sla!} teams={PREVIEW_TEAMS.map(({ id, name }) => ({ id, name }))} canEdit={previewScope(as, "teams.manage") === "all"} />
    </SettingsFrame>
  );
}
