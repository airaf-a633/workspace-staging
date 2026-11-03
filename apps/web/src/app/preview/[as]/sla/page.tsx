import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { SlaSettingsPage } from "@/components/sla/sla-settings";
import { getT, getTimeZone } from "@/i18n/server";
import { previewInbox, previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("settings"))("sla") };
}

export default async function PreviewSla(props: PageProps<"/preview/[as]/sla">) {
  const { as } = await props.params;
  const t = await getT("slaSettings");
  const data = previewInbox(as, await getTimeZone());
  const teams = data.teams.map(({ id, name }) => ({ id, name }));
  // Every team shows hours, even one the sample rules did not name.
  const base = data.sla!;
  const first = Object.values(base.schedules)[0];
  const sla = { ...base, schedules: Object.fromEntries(teams.map((x) => [x.id, base.schedules[x.id] ?? first])) };
  const scope = previewScope(as, "teams.manage");
  return (
    <SettingsFrame base={`/preview/${as}`} active="sla" isOwner={previewScope(as, "members.manage") !== "none"}>
      <SectionHeader title={t("title")} description={t("description")} />
      <SlaSettingsPage initial={sla} teams={teams} editable={{ all: scope === "all", teams: scope === "team" ? data.viewer.teamIds : [] }} />
    </SettingsFrame>
  );
}
