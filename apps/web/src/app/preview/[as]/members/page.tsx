import Link from "next/link";
import { Checkbox, SelectInput, TextInput } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { ListSurface, SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { PreviewNote } from "@/components/preview/preview-note";
import { PREVIEW_TEAMS, previewMembers, previewPerson, previewScope } from "@/lib/preview";

export const metadata = { title: "Team members" };

export default async function PreviewMembers(props: PageProps<"/preview/[as]/members">) {
  const { as } = await props.params;
  const sp = await props.searchParams;
  const me = previewPerson(as);
  const isManager = previewScope(as, "members.manage") !== "none";
  const inviting = isManager && sp.invite === "1";
  const members = previewMembers();
  const team = (id: string) => PREVIEW_TEAMS.find((t) => t.id === id)?.name;
  const base = `/preview/${as}`;

  return (
    <SettingsFrame base={base} active="members" isOwner={isManager}>
      <SectionHeader
        title="Team members"
        description="Everyone who can sign in to this workspace, and what they can do."
        action={isManager && !inviting ? <Link href="?invite=1" className={buttonClass("primary", "sm")}>Invite</Link> : undefined}
      />

      {inviting && (
        <div className="grid gap-4 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-2)] ring-1 ring-border">
          <fieldset disabled className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Their email" name="email" type="email" placeholder="name@business.ae" />
              <SelectInput label="Role" name="role" defaultValue="agent">
                {members.filter((m) => m.template !== "owner").map((m) => <option key={m.template} value={m.template}>{m.role}</option>)}
              </SelectInput>
            </div>
            <div className="grid gap-1">
              <p className="text-sm font-medium">Teams <span className="font-normal text-muted">(empty means the default team)</span></p>
              <div className="flex flex-wrap gap-x-6">
                {PREVIEW_TEAMS.map((t) => <Checkbox key={t.id} name="team" value={t.id} label={t.name} />)}
              </div>
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PreviewNote />
            <span className="ms-auto flex gap-2">
              <Link href={`${base}/members`} className={buttonClass("ghost", "sm")}>Cancel</Link>
              <button type="button" disabled className={buttonClass("primary", "sm")}>Create invite link</button>
            </span>
          </div>
        </div>
      )}

      <ListSurface>
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-hidden="true">{m.name[0]}</span>
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{m.name}{m.id === me.id && <span className="font-normal text-muted"> (you)</span>}</span>
              <span className="truncate text-sm text-muted">{m.teams.map(team).join(", ")}</span>
            </span>
            <span className="text-sm text-muted">{m.role}</span>
          </li>
        ))}
      </ListSurface>
    </SettingsFrame>
  );
}
