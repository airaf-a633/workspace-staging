import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Submit } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
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
    <>
      <Link href={`/w/${slug}/roles`} className="flex min-h-11 w-fit items-center gap-2 text-sm text-primary">
        <ArrowLeft size={18} className="rtl:rotate-180" aria-hidden="true" /> All roles
      </Link>
      <PageHeader title={role.name} description="Choose how far each permission reaches. Owner-only permissions can't be given to other roles." />
      {typeof sp.error === "string" && <Notice tone="error" title={sp.error} />}
      {sp.saved && <Notice tone="success" title="Role saved" />}

      <form action={saveRolePermissions} className="grid gap-6">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="roleId" value={id} />
        <Card>
          <div className="sm:max-w-sm">
            <TextInput label="Role name" name="name" defaultValue={role.name} required />
          </div>
        </Card>
        <Card title="Permissions">
          <ul className="divide-y divide-border">
            {perms?.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <label htmlFor={`perm-${p.key}`} className="flex-1">
                  {p.description}
                  {p.owner_only && <span className="block text-sm text-muted">Owner only</span>}
                </label>
                <select
                  id={`perm-${p.key}`}
                  name={p.owner_only ? undefined : `perm:${p.key}`}
                  defaultValue={scope.get(p.key) ?? "none"}
                  disabled={p.owner_only}
                  className="min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 disabled:opacity-60"
                >
                  <option value="none">No access</option>
                  <option value="own">Own</option>
                  <option value="team">Their teams</option>
                  <option value="all">Whole workspace</option>
                </select>
              </li>
            ))}
          </ul>
        </Card>
        <div><Submit>Save role</Submit></div>
      </form>

      <Card title="Delete this role" description="Only possible when nobody uses it.">
        <form action={deleteRole}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="roleId" value={id} />
          <Submit variant="destructive" pending="Deleting…">Delete {role.name}</Submit>
        </form>
      </Card>
    </>
  );
}
