import { Badge } from "@/components/ui/surface";
import { ListSurface, SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { PREVIEW_TEAMS, previewMembers, previewScope } from "@/lib/preview";
import { roleLabel } from "@/i18n/labels";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("settings"))("teams") };
}

export default async function PreviewTeams(props: PageProps<"/preview/[as]/teams">) {
  const { as } = await props.params;
  const members = previewMembers();
  const t = await getT("teamsPage");
  const tAll = await getT();
  return (
    <SettingsFrame base={`/preview/${as}`} active="teams" isOwner={previewScope(as, "members.manage") !== "none"}>
      <SectionHeader title={t("title")} description={t("description")} />
      <ListSurface>
        {PREVIEW_TEAMS.map((team) => {
          const people = members.filter((m) => m.teams.includes(team.id));
          return (
            <li key={team.id} className="grid gap-3 border-b border-border px-5 py-4 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {team.name}
                  {team.isBranch && <Badge tone="transit">{t("branch")}</Badge>}
                  {team.isDefault && <Badge>{t("default")}</Badge>}
                </p>
                <span className="text-sm text-muted">{t("people", { count: people.length })}</span>
              </div>
              <ul className="flex flex-wrap gap-2">
                {people.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 ps-1 pe-3 text-sm">
                    <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary" aria-hidden="true">{m.name[0]}</span>
                    {m.name} <span className="text-muted">{roleLabel(tAll, m.role)}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ListSurface>
    </SettingsFrame>
  );
}
