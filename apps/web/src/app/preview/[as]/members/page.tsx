import { Checkbox, SelectInput, TextInput } from "@/components/ui/field";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { buttonClass } from "@/components/ui/button";
import { PreviewNote } from "@/components/preview/preview-note";
import { PREVIEW_TEAMS, previewMembers, previewPerson, previewScope } from "@/lib/preview";

export const metadata = { title: "Team members" };

export default async function PreviewMembers(props: PageProps<"/preview/[as]/members">) {
  const { as } = await props.params;
  const me = previewPerson(as);
  const isManager = previewScope(as, "members.manage") !== "none";
  const members = previewMembers();
  const team = (id: string) => PREVIEW_TEAMS.find((t) => t.id === id)?.name;

  return (
    <>
      <PageHeader title="Team members" description="Everyone who can sign in to this workspace, and what they can do." />
      {isManager && <PreviewNote />}

      <Card title={`Members (${members.length})`}>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary-soft font-medium text-primary" aria-hidden="true">{m.name[0]}</span>
                <div className="grid">
                  <span className="font-medium">{m.name}{m.id === me.id && <span className="font-normal text-muted"> (you)</span>}</span>
                  <span className="text-sm text-muted">{m.teams.map(team).join(", ")}</span>
                </div>
              </div>
              <Badge>{m.role}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      {isManager && (
        <Card title="Invite someone" description="They'll get a link to create an account or sign in with this email.">
          <fieldset disabled className="grid gap-4 sm:max-w-md">
            <TextInput label="Their email" name="email" type="email" placeholder="name@business.ae" />
            <SelectInput label="Role" name="role" defaultValue="agent">
              {members.filter((m) => m.template !== "owner").map((m) => <option key={m.template} value={m.template}>{m.role}</option>)}
            </SelectInput>
            <div className="grid gap-1">
              <p className="text-sm font-medium">Teams</p>
              {PREVIEW_TEAMS.map((t) => <Checkbox key={t.id} name="team" value={t.id} label={t.name} />)}
            </div>
            <button type="button" className={buttonClass("primary")}>Create invite</button>
          </fieldset>
        </Card>
      )}
    </>
  );
}
