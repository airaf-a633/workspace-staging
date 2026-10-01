import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { Card, Notice } from "@/components/ui/surface";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { can, loadWorkspace } from "@/lib/workspace";
import { deleteRole, saveRolePermissions } from "../actions";
import { errorText, permissionLabel } from "@/i18n/labels";
import { getT } from "@/i18n/server";

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
  const t = await getT("rolesPage");
  const tAll = await getT();
  const error = errorText(tAll, "rolesPage", sp.error, { permission: permissionLabel(tAll, String(sp.perm ?? "")) });

  return (
    <SettingsFrame base={`/w/${slug}`} active="roles" isOwner>
      <Link href={`/w/${slug}/roles`} className="flex min-h-11 w-fit items-center gap-2 text-sm text-primary">
        <ArrowLeft size={18} className="rtl:rotate-180" aria-hidden="true" /> {t("allRoles")}
      </Link>
      <SectionHeader title={role.name} description={t("editDescription")} />
      {error && <Notice tone="error" title={error} />}
      {sp.saved && <Notice tone="success" title={t("saved")} />}

      <form action={saveRolePermissions} className="grid gap-6">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="roleId" value={id} />
        <Card>
          <div className="sm:max-w-sm">
            <TextInput label={t("name")} name="name" defaultValue={role.name} required />
          </div>
        </Card>
        <Card title={t("permissions")}>
          <ul className="divide-y divide-border">
            {perms?.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <label htmlFor={`perm-${p.key}`} className="flex-1">
                  {permissionLabel(tAll, p.key)}
                  {p.owner_only && <span className="block text-sm text-muted">{t("ownerOnlyLabel")}</span>}
                </label>
                <select
                  id={`perm-${p.key}`}
                  name={p.owner_only ? undefined : `perm:${p.key}`}
                  defaultValue={scope.get(p.key) ?? "none"}
                  disabled={p.owner_only}
                  className="min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 disabled:opacity-60"
                >
                  <option value="none">{t("scope.none")}</option>
                  <option value="own">{t("scope.own")}</option>
                  <option value="team">{t("scope.team")}</option>
                  <option value="all">{t("scope.all")}</option>
                </select>
              </li>
            ))}
          </ul>
        </Card>
        <div><Submit>{t("save")}</Submit></div>
      </form>

      <Card title={t("deleteTitle")} description={t("deleteHelp")}>
        <form action={deleteRole}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="roleId" value={id} />
          <Submit variant="destructive" pending={tAll("teamsPage.deleting")}>{t("delete", { name: role.name })}</Submit>
        </form>
      </Card>
    </SettingsFrame>
  );
}
