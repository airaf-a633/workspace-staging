import Link from "next/link";
import { Checkbox, SelectInput, TextInput } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { ListSurface, SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { PreviewNote } from "@/components/preview/preview-note";
import { PREVIEW_TEAMS, previewMembers, previewPerson, previewScope } from "@/lib/preview";
import { roleLabel } from "@/i18n/labels";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("settings"))("members") };
}

export default async function PreviewMembers(props: PageProps<"/preview/[as]/members">) {
  const { as } = await props.params;
  const sp = await props.searchParams;
  const me = previewPerson(as);
  const isManager = previewScope(as, "members.manage") !== "none";
  const inviting = isManager && sp.invite === "1";
  const members = previewMembers();
  const team = (id: string) => PREVIEW_TEAMS.find((x) => x.id === id)?.name;
  const base = `/preview/${as}`;
  const t = await getT("members");
  const tAll = await getT();

  return (
    <SettingsFrame base={base} active="members" isOwner={isManager}>
      <SectionHeader
        title={t("title")}
        description={t("description")}
        action={isManager && !inviting ? <Link href="?invite=1" className={buttonClass("primary", "sm")}>{t("invite")}</Link> : undefined}
      />

      {inviting && (
        <div className="grid gap-4 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-2)] ring-1 ring-border">
          <fieldset disabled className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label={t("email")} name="email" type="email" dir="ltr" placeholder="name@business.ae" />
              <SelectInput label={t("role")} name="role" defaultValue="agent">
                {members.filter((m) => m.template !== "owner").map((m) => <option key={m.template} value={m.template}>{roleLabel(tAll, m.role)}</option>)}
              </SelectInput>
            </div>
            <div className="grid gap-1">
              <p className="text-sm font-medium">{t("teams")} <span className="font-normal text-muted">{t("teamsHelp")}</span></p>
              <div className="flex flex-wrap gap-x-6">
                {PREVIEW_TEAMS.map((x) => <Checkbox key={x.id} name="team" value={x.id} label={x.name} />)}
              </div>
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PreviewNote />
            <span className="ms-auto flex gap-2">
              <Link href={`${base}/members`} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</Link>
              <button type="button" disabled className={buttonClass("primary", "sm")}>{t("createLink")}</button>
            </span>
          </div>
        </div>
      )}

      <ListSurface>
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-hidden="true">{m.name[0]}</span>
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{m.name}{m.id === me.id && <span className="font-normal text-muted"> {t("youMark")}</span>}</span>
              <span className="truncate text-sm text-muted">{m.teams.map(team).join(", ")}</span>
            </span>
            <span className="text-sm text-muted">{roleLabel(tAll, m.role)}</span>
          </li>
        ))}
      </ListSurface>
    </SettingsFrame>
  );
}
