import Link from "next/link";
import { notFound } from "next/navigation";
import { Submit } from "@/components/ui/submit";
import { SelectInput, TextInput } from "@/components/ui/field";
import { Card, Notice } from "@/components/ui/surface";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { can, loadWorkspace } from "@/lib/workspace";
import { createRole } from "./actions";
import { errorText, permissionLabel, roleLabel } from "@/i18n/labels";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("rolesPage"))("metaTitle") };
}

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
  const t = await getT("rolesPage");
  const tAll = await getT();
  const error = errorText(tAll, "rolesPage", sp.error, { permission: permissionLabel(tAll, String(sp.perm ?? "")) });

  return (
    <SettingsFrame base={`/w/${slug}`} active="roles" isOwner>
      <SectionHeader title={t("title")} description={t("description")} />
      {error && <Notice tone="error" title={error} />}

      <Card title={t("custom")}>
        {custom.length > 0 ? (
          <ul className="divide-y divide-border">
            {custom.map((r) => (
              <li key={r.id} className="py-2">
                <Link className="flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline" href={`/w/${slug}/roles/${r.id}`}>{r.name}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t("noneYet")}</p>
        )}
        <form action={createRole} className="grid gap-3 border-t border-border pt-4 sm:max-w-sm">
          <input type="hidden" name="slug" value={slug} />
          <TextInput label={t("newName")} name="name" placeholder={t("newPlaceholder")} required />
          <SelectInput label={t("startFrom")} name="from" defaultValue="agent">
            {(["sales_manager", "support_manager", "ops_manager", "agent", "viewer"] as const).map((k) => <option key={k} value={k}>{tAll(`roles.${k}`)}</option>)}
          </SelectInput>
          <Submit pending={tAll("onboarding.creating")}>{t("create")}</Submit>
        </form>
      </Card>

      <Card title={t("matrixTitle")} description={t("matrixHelp")}>
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="sticky start-0 bg-surface px-6 py-2 text-start font-medium">{t("permission")}</th>
                {roles?.map((r) => <th key={r.id} scope="col" className="px-3 py-2 text-start font-medium whitespace-nowrap">{roleLabel(tAll, r.name)}</th>)}
              </tr>
            </thead>
            <tbody>
              {perms?.map((p) => (
                <tr key={p.key} className="border-b border-border last:border-0">
                  <th scope="row" className="sticky start-0 bg-surface px-6 py-2 text-start font-normal">
                    {permissionLabel(tAll, p.key)}{p.owner_only && <span className="text-muted"> {t("ownerOnly")}</span>}
                  </th>
                  {roles?.map((r) => {
                    const s = scope.get(`${r.id}:${p.key}`) ?? "none";
                    return <td key={r.id} className={`px-3 py-2 ${s === "none" ? "text-muted" : ""}`}>{s === "none" ? "—" : t(`cell.${s as "own" | "team" | "all"}`)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </SettingsFrame>
  );
}
