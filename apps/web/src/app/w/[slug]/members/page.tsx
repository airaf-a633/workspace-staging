import Link from "next/link";
import { cookies } from "next/headers";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Submit } from "@/components/ui/submit";
import { CopyField } from "@/components/ui/copy-button";
import { Checkbox, SelectInput, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { buttonClass } from "@/components/ui/button";
import { ListSurface, SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { can, loadWorkspace } from "@/lib/workspace";
import { changeRole, inviteMember, removeMember, revokeInvite } from "./actions";

export const metadata = { title: "Team members" };

export default async function Members(props: PageProps<"/w/[slug]/members">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const isManager = await can(workspace.id, "members.manage");
  const inviting = isManager && sp.invite === "1";

  const [{ data: members }, { data: roles }, { data: teams }, { data: links }, { data: invites }] = await Promise.all([
    supabase.from("members").select("id, display_name, status, role_id, roles(name)").eq("workspace_id", workspace.id).eq("status", "active").order("display_name"),
    supabase.from("roles").select("id, name, key").eq("workspace_id", workspace.id).order("name"),
    supabase.from("teams").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("team_members").select("team_id, member_id").eq("workspace_id", workspace.id),
    isManager
      ? supabase.from("invites").select("id, email, expires_at, roles(name)").eq("workspace_id", workspace.id).is("accepted_at", null).order("created_at")
      : Promise.resolve({ data: [] as { id: string; email: string; expires_at: string; roles: unknown }[] }),
  ]);

  const inviteLink = (await cookies()).get("invite_link")?.value;
  const roleName = (r: unknown) => (Array.isArray(r) ? r[0]?.name : (r as { name?: string } | null)?.name) ?? "";
  const teamsOf = (memberId: string) =>
    (links ?? []).filter((l) => l.member_id === memberId).map((l) => teams?.find((t) => t.id === l.team_id)?.name).filter(Boolean).join(", ");
  const base = `/w/${slug}`;

  return (
    <SettingsFrame base={base} active="members" isOwner={isManager}>
      <SectionHeader
        title="Team members"
        description="Everyone who can sign in to this workspace, and what they can do."
        action={isManager && !inviting ? <Link href="?invite=1" className={buttonClass("primary", "sm")}>Invite</Link> : undefined}
      />

      {typeof sp.error === "string" && <Notice tone="error" title={sp.error} />}
      {typeof sp.invited === "string" && inviteLink && (
        <Notice tone="success" title={`Invite created for ${sp.invited}`}>
          <div className="grid gap-2">
            <p>Send them this link. It works once, expires in 7 days, and won&apos;t be shown again.</p>
            <CopyField value={inviteLink} label="Invite link" />
          </div>
        </Notice>
      )}

      {inviting && (
        <form action={inviteMember} className="grid gap-4 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-2)] ring-1 ring-border">
          <input type="hidden" name="slug" value={slug} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Their email" name="email" type="email" autoComplete="off" required autoFocus />
            <SelectInput label="Role" name="role" required defaultValue={roles?.find((r) => r.key === "agent")?.id}>
              {roles?.filter((r) => r.key !== "owner").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectInput>
          </div>
          <fieldset className="grid gap-1">
            <legend className="text-sm font-medium">Teams <span className="font-normal text-muted">(empty means the default team)</span></legend>
            <div className="flex flex-wrap gap-x-6">
              {teams?.map((t) => <Checkbox key={t.id} name="team" value={t.id} label={t.name} />)}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Link href={`${base}/members`} className={buttonClass("ghost", "sm")}>Cancel</Link>
            <Submit size="sm" pending="Creating invite…">Create invite link</Submit>
          </div>
        </form>
      )}

      <ListSurface>
        {members?.map((m) => (
          <li key={m.id} className="border-b border-border last:border-0">
            <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-hidden="true">
                {m.display_name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-medium">{m.display_name}{m.id === me.id && <span className="font-normal text-muted"> (you)</span>}</span>
                <span className="truncate text-sm text-muted">{teamsOf(m.id) || "No team"}</span>
              </span>
              <span className="text-sm text-muted">{roleName(m.roles)}</span>
              {isManager && m.id !== me.id && (
                <details className="group w-full sm:w-auto">
                  <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
                    Manage <CaretDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="mt-2 grid gap-4 rounded-[var(--radius-control)] bg-surface-2 p-4 sm:absolute sm:end-5 sm:z-10 sm:w-80 sm:bg-surface sm:shadow-[var(--shadow-2)] sm:ring-1 sm:ring-border">
                    <form action={changeRole} className="grid gap-3">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="memberId" value={m.id} />
                      <SelectInput label={`Role for ${m.display_name}`} name="roleId" defaultValue={m.role_id}>
                        {roles?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </SelectInput>
                      <Submit variant="secondary" size="sm">Change role</Submit>
                    </form>
                    <details className="border-t border-border pt-3">
                      <summary className="min-h-9 cursor-pointer list-none text-sm font-medium text-fail [&::-webkit-details-marker]:hidden">Remove from workspace…</summary>
                      <form action={removeMember} className="mt-2 grid gap-2">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="memberId" value={m.id} />
                        <p className="text-sm">{m.display_name} loses access immediately. Their past messages and notes stay.</p>
                        <Submit variant="destructive" size="sm" pending="Removing…">Remove {m.display_name}</Submit>
                      </form>
                    </details>
                  </div>
                </details>
              )}
            </div>
          </li>
        ))}
      </ListSurface>

      {isManager && invites && invites.length > 0 && (
        <section className="grid gap-3">
          <h3 className="text-sm font-medium text-muted">Waiting to join</h3>
          <ListSurface>
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-0">
                <span className="grid">
                  <span className="font-medium">{i.email}</span>
                  <span className="text-sm text-muted">
                    {roleName(i.roles)}, expires {new Date(i.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dubai" })}
                  </span>
                </span>
                <form action={revokeInvite}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="inviteId" value={i.id} />
                  <Submit variant="ghost" size="sm" pending="Cancelling…">Cancel invite</Submit>
                </form>
              </li>
            ))}
          </ListSurface>
        </section>
      )}
    </SettingsFrame>
  );
}
