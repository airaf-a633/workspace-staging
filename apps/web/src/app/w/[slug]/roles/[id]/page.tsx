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

/*
 * A custom role, as plain questions (simplicity pass 2026-10-19): permissions grouped by what they're about,
 * each answered No / Only their own / Their teams / Everything. Rarely changed groups fold away.
 * The form fields and the save action are unchanged.
 */
type Group = "chats" | "customers" | "deals" | "work" | "campaigns" | "business";
const GROUPS: Group[] = ["chats", "customers", "deals", "work", "campaigns", "business"];
const FOLDED: Group[] = ["campaigns", "business"];
function groupOf(key: string): Group {
  const head = key.split(".")[0];
  if (head === "conversations") return "chats";
  if (head === "contacts") return "customers";
  if (head === "deals") return "deals";
  if (["tasks", "templates", "canned", "orders"].includes(head)) return "work";
  if (head === "campaigns") return "campaigns";
  return "business";
}

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
        {GROUPS.map((g) => {
          const list = (perms ?? []).filter((p) => groupOf(p.key) === g);
          if (list.length === 0) return null;
          const rows = (
            <ul className="divide-y divide-border">
              {list.map((p) => (
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
          );
          return FOLDED.includes(g) ? (
            <details key={g} className="group rounded-[var(--radius-panel)] bg-surface px-6 shadow-[var(--shadow-1)] ring-1 ring-border">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                {t(`questions.${g}`)}
                <span aria-hidden="true" className="text-xl font-normal text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="pb-4">{rows}</div>
            </details>
          ) : (
            <Card key={g} title={t(`questions.${g}`)}>{rows}</Card>
          );
        })}
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
