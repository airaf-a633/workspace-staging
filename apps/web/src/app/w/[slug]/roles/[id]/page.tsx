import { notFound } from "next/navigation";
import { Notice, Page, Submit } from "@/components/plain";
import { can, loadWorkspace } from "@/lib/workspace";
import { deleteRole, saveRolePermissions } from "../actions";

export default async function EditRole(props: PageProps<"/w/[slug]/roles/[id]">) {
  const { slug, id } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "members.manage"))) notFound();

  const { data: role } = await supabase.from("roles").select("id, name, template_key").eq("id", id).eq("workspace_id", workspace.id).maybeSingle();
  if (!role || role.template_key) notFound();
  const [{ data: perms }, { data: grants }] = await Promise.all([
    supabase.from("permissions").select("key, description, owner_only").order("key"),
    supabase.from("role_permissions").select("permission, scope").eq("role_id", id),
  ]);
  const scope = new Map(grants?.map((g) => [g.permission, g.scope]));

  return (
    <Page title={`Edit role: ${role.name}`}>
      {typeof sp.error === "string" && <Notice tone="error">{sp.error}</Notice>}
      {sp.saved && <Notice tone="info">Saved.</Notice>}
      <form action={saveRolePermissions} className="grid gap-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="roleId" value={id} />
        <label className="grid gap-1 text-sm font-medium">
          Role name
          <input name="name" defaultValue={role.name} required className="rounded border border-slate-500 px-3 py-2 font-normal" />
        </label>
        <fieldset className="grid gap-2">
          <legend className="font-medium">Permissions</legend>
          {perms?.map((p) => (
            <label key={p.key} className="flex items-center justify-between gap-4 border-t pt-2 text-sm">
              <span>{p.description}{p.owner_only ? " (owner only)" : ""}</span>
              <select name={p.owner_only ? undefined : `perm:${p.key}`} defaultValue={scope.get(p.key) ?? "none"} disabled={p.owner_only} className="rounded border border-slate-500 px-2 py-1">
                <option value="none">No access</option>
                <option value="own">Own</option>
                <option value="team">Their teams</option>
                <option value="all">Whole workspace</option>
              </select>
            </label>
          ))}
        </fieldset>
        <Submit>Save role</Submit>
      </form>
      <form action={deleteRole}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="roleId" value={id} />
        <Submit variant="secondary">Delete role</Submit>
      </form>
    </Page>
  );
}
