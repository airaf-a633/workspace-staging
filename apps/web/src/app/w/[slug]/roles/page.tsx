import Link from "next/link";
import { notFound } from "next/navigation";
import { Submit } from "@/components/ui/button";
import { SelectInput, TextInput } from "@/components/ui/field";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import { can, loadWorkspace } from "@/lib/workspace";
import { createRole } from "./actions";

const LABEL: Record<string, string> = { none: "—", own: "Own", team: "Team", all: "All" };

export default async function Roles(props: PageProps<"/w/[slug]/roles">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "members.manage"))) notFound();

  const [{ data: roles }, { data: perms }, { data: grants }] = await Promise.all([
    supabase.from("roles").select("id, name, key, template_key").eq("workspace_id", workspace.id).order("created_at"),
    supabase.from("permissions").select("key, description, owner_only").order("key"),
    supabase.from("role_permissions").select("role_id, permission, scope").eq("workspace_id", workspace.id),
  ]);
  const scope = new Map(grants?.map((g) => [`${g.role_id}:${g.permission}`, g.scope]));
  const custom = roles?.filter((r) => !r.template_key) ?? [];

  return (
    <>
      <PageHeader title="Roles and permissions" description="The six built-in roles are fixed. Make a custom role by copying one, then change what it can do." />
      {typeof sp.error === "string" && <Notice tone="error" title={sp.error} />}

      <Card title="Custom roles">
        {custom.length > 0 ? (
          <ul className="divide-y divide-border">
            {custom.map((r) => (
              <li key={r.id} className="py-2">
                <Link className="flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline" href={`/w/${slug}/roles/${r.id}`}>{r.name}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">None yet. Most businesses don&apos;t need one.</p>
        )}
        <form action={createRole} className="grid gap-3 border-t border-border pt-4 sm:max-w-sm">
          <input type="hidden" name="slug" value={slug} />
          <TextInput label="New role name" name="name" placeholder="e.g. Branch lead" required />
          <SelectInput label="Start from" name="from" defaultValue="agent">
            <option value="sales_manager">Sales manager</option>
            <option value="support_manager">Support manager</option>
            <option value="ops_manager">Operations manager</option>
            <option value="agent">Agent</option>
            <option value="viewer">Viewer</option>
          </SelectInput>
          <Submit pending="Creating…">Create role</Submit>
        </form>
      </Card>

      <Card title="What each role can do" description="All = the whole workspace. Team = their teams. Own = what they hold or own.">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="sticky start-0 bg-surface px-5 py-2 text-start font-medium">Permission</th>
                {roles?.map((r) => <th key={r.id} scope="col" className="px-3 py-2 text-start font-medium whitespace-nowrap">{r.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {perms?.map((p) => (
                <tr key={p.key} className="border-b border-border last:border-0">
                  <th scope="row" className="sticky start-0 bg-surface px-5 py-2 text-start font-normal">
                    {p.description}{p.owner_only && <span className="text-muted"> (owner only)</span>}
                  </th>
                  {roles?.map((r) => {
                    const s = scope.get(`${r.id}:${p.key}`) ?? "none";
                    return <td key={r.id} className={`px-3 py-2 ${s === "none" ? "text-muted" : ""}`}>{LABEL[s]}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
