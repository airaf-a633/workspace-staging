import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { PREVIEW_TEAMS, previewMembers } from "@/lib/preview";

export const metadata = { title: "Teams and branches" };

export default function PreviewTeams() {
  const members = previewMembers();
  return (
    <>
      <PageHeader title="Teams and branches" description="A branch is a team with its own location. Conversations, reply targets and routing are set per team." />
      {PREVIEW_TEAMS.map((t) => {
        const people = members.filter((m) => m.teams.includes(t.id));
        return (
          <Card
            key={t.id}
            title={<span className="flex flex-wrap items-center gap-2">{t.name}{t.isBranch && <Badge tone="transit">Branch</Badge>}{t.isDefault && <Badge>Default</Badge>}</span>}
            description={`${people.length} ${people.length === 1 ? "person" : "people"}`}
          >
            <ul className="flex flex-wrap gap-2">
              {people.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-full border border-border py-1 ps-1 pe-3">
                  <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-sm font-medium text-primary" aria-hidden="true">{m.name[0]}</span>
                  {m.name} <span className="text-sm text-muted">{m.role}</span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </>
  );
}
