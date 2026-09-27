import { cookies } from "next/headers";
import { Field, Notice, Page, Submit } from "@/components/plain";
import { can, loadWorkspace } from "@/lib/workspace";
import { inviteMember, removeMember, revokeInvite } from "./actions";

export default async function Members(props: PageProps<"/w/[slug]/members">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const isManager = await can(workspace.id, "members.manage");

  const [{ data: members }, { data: roles }, { data: teams }, { data: invites }] = await Promise.all([
    supabase.from("members").select("id, display_name, status, roles(name)").eq("workspace_id", workspace.id).eq("status", "active").order("display_name"),
    supabase.from("roles").select("id, name, key").eq("workspace_id", workspace.id).order("name"),
    supabase.from("teams").select("id, name").eq("workspace_id", workspace.id).order("name"),
    isManager
      ? supabase.from("invites").select("id, email, expires_at, roles(name)").eq("workspace_id", workspace.id).is("accepted_at", null).order("created_at")
      : Promise.resolve({ data: [] as { id: string; email: string; expires_at: string; roles: unknown }[] }),
  ]);

  const inviteLink = (await cookies()).get("invite_link")?.value;
  const roleName = (r: unknown) => (Array.isArray(r) ? r[0]?.name : (r as { name?: string } | null)?.name) ?? "";

  return (
    <Page title="Team">
      {typeof sp.error === "string" && <Notice tone="error">{sp.error}</Notice>}
      {typeof sp.invited === "string" && inviteLink && (
        <Notice tone="info">
          Invite created for {sp.invited}. Send them this link (it works once and expires in 7 days; it won&apos;t be shown again):{" "}
          <code className="break-all">{inviteLink}</code>
        </Notice>
      )}

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Members</h2>
        <ul className="divide-y">
          {members?.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-2">
              <span>
                {m.display_name} <span className="text-sm text-slate-600">{roleName(m.roles)}</span>
              </span>
              {isManager && m.id !== me.id && (
                <form action={removeMember}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="memberId" value={m.id} />
                  <button type="submit" className="text-sm underline">Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isManager && (
        <>
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">Invite someone</h2>
            <form action={inviteMember} className="grid gap-4">
              <input type="hidden" name="slug" value={slug} />
              <Field label="Their email" name="email" type="email" required />
              <label className="grid gap-1 text-sm font-medium">
                Role
                <select name="role" required className="rounded border border-slate-500 px-3 py-2 font-normal" defaultValue={roles?.find((r) => r.key === "agent")?.id}>
                  {roles?.filter((r) => r.key !== "owner").map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
              <fieldset className="grid gap-1 text-sm">
                <legend className="font-medium">Teams (none chosen means the default team)</legend>
                {teams?.map((t) => (
                  <label key={t.id} className="flex gap-2">
                    <input type="checkbox" name="team" value={t.id} /> {t.name}
                  </label>
                ))}
              </fieldset>
              <Submit>Create invite</Submit>
            </form>
          </section>

          {invites && invites.length > 0 && (
            <section className="grid gap-2">
              <h2 className="text-lg font-semibold">Waiting to join</h2>
              <ul className="divide-y">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-4 py-2">
                    <span>
                      {i.email} <span className="text-sm text-slate-600">{roleName(i.roles)}, expires {new Date(i.expires_at).toLocaleDateString("en-AE")}</span>
                    </span>
                    <form action={revokeInvite}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="inviteId" value={i.id} />
                      <button type="submit" className="text-sm underline">Cancel invite</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Page>
  );
}
