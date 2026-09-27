import Link from "next/link";
import { notFound } from "next/navigation";
import { Field, Notice, Page, Submit } from "@/components/plain";
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

  return (
    <Page title="Roles">
      {typeof sp.error === "string" && <Notice tone="error">{sp.error}</Notice>}
      <p className="text-sm">The six built-in roles are fixed. Create a custom role from one of them, then change what it can do.</p>

      <form action={createRole} className="grid gap-4">
        <input type="hidden" name="slug" value={slug} />
        <Field label="New role name" name="name" required />
        <label className="grid gap-1 text-sm font-medium">
          Start from
          <select name="from" className="rounded border border-slate-500 px-3 py-2 font-normal" defaultValue="agent">
            <option value="sales_manager">Sales manager</option>
            <option value="support_manager">Support manager</option>
            <option value="ops_manager">Operations manager</option>
            <option value="agent">Agent</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <Submit>Create role</Submit>
      </form>

      <div className="overflow-x-auto">
        <table className="text-sm">
          <caption className="text-start font-semibold">What each role can do (All = whole workspace, Team = their teams, Own = what they hold)</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2 text-start">Permission</th>
              {roles?.map((r) => (
                <th key={r.id} scope="col" className="p-2 text-start">
                  {r.template_key ? r.name : <Link className="underline" href={`/w/${slug}/roles/${r.id}`}>{r.name}</Link>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perms?.map((p) => (
              <tr key={p.key} className="border-t">
                <th scope="row" className="p-2 text-start font-normal">{p.description}{p.owner_only ? " (owner only)" : ""}</th>
                {roles?.map((r) => (
                  <td key={r.id} className="p-2">{LABEL[scope.get(`${r.id}:${p.key}`) ?? "none"]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
