import { Badge } from "@/components/ui/surface";
import { ListSurface, SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { PREVIEW_TEAMS, previewMembers, previewScope } from "@/lib/preview";

export const metadata = { title: "Teams and branches" };

export default async function PreviewTeams(props: PageProps<"/preview/[as]/teams">) {
  const { as } = await props.params;
  const members = previewMembers();
  return (
    <SettingsFrame base={`/preview/${as}`} active="teams" isOwner={previewScope(as, "members.manage") !== "none"}>
      <SectionHeader title="Teams and branches" description="A branch is a team with its own location. Conversations, reply targets and routing are set per team." />
      <ListSurface>
        {PREVIEW_TEAMS.map((t) => {
          const people = members.filter((m) => m.teams.includes(t.id));
          return (
            <li key={t.id} className="grid gap-3 border-b border-border px-5 py-4 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {t.name}
                  {t.isBranch && <Badge tone="transit">Branch</Badge>}
                  {t.isDefault && <Badge>Default</Badge>}
                </p>
                <span className="text-sm text-muted">{people.length} {people.length === 1 ? "person" : "people"}</span>
              </div>
              <ul className="flex flex-wrap gap-2">
                {people.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 ps-1 pe-3 text-sm">
                    <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary" aria-hidden="true">{m.name[0]}</span>
                    {m.name} <span className="text-muted">{m.role}</span>
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
