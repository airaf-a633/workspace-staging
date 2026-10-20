import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { LabelsSettings } from "@/components/labels/labels-settings";
import { getT, getTimeZone } from "@/i18n/server";
import { previewInbox, previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("settings"))("labels") };
}

export default async function PreviewLabels(props: PageProps<"/preview/[as]/labels">) {
  const { as } = await props.params;
  const t = await getT("labelsSettings");
  const data = previewInbox(as, await getTimeZone());
  const usage: Record<string, number> = {};
  for (const c of data.conversations) for (const id of c.labels ?? []) usage[id] = (usage[id] ?? 0) + 1;
  return (
    <SettingsFrame base={`/preview/${as}`} active="labels" isOwner={previewScope(as, "members.manage") !== "none"}>
      <SectionHeader title={t("title")} description={t("description")} />
      <LabelsSettings initial={data.labels} usage={usage} canEdit={previewScope(as, "crm.settings") !== "none"} />
    </SettingsFrame>
  );
}
