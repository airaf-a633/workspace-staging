import { notFound } from "next/navigation";
import { PERMISSIONS, ROLE_TEMPLATES, scopeFor } from "@app/domain";
import { Card } from "@/components/ui/surface";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { previewScope } from "@/lib/preview";
import { permissionLabel } from "@/i18n/labels";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("rolesPage"))("metaTitle") };
}

export default async function PreviewRoles(props: PageProps<"/preview/[as]/roles">) {
  const { as } = await props.params;
  if (previewScope(as, "members.manage") === "none") notFound();
  const t = await getT("rolesPage");
  const tAll = await getT();

  return (
    <SettingsFrame base={`/preview/${as}`} active="roles" isOwner>
      <SectionHeader title={t("title")} description={t("description")} />
      <Card title={t("matrixTitle")} description={t("matrixHelp")}>
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="sticky start-0 bg-surface px-6 py-2 text-start font-medium">{t("permission")}</th>
                {ROLE_TEMPLATES.map((r) => <th key={r.key} scope="col" className="whitespace-nowrap px-3 py-2 text-start font-medium">{tAll(`roles.${r.key}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.key} className="border-b border-border last:border-0">
                  <th scope="row" className="sticky start-0 bg-surface px-6 py-2 text-start font-normal">
                    {permissionLabel(tAll, p.key)}{p.ownerOnly && <span className="text-muted"> {t("ownerOnly")}</span>}
                  </th>
                  {ROLE_TEMPLATES.map((r) => {
                    const s = scopeFor(p, r.key);
                    return <td key={r.key} className={`px-3 py-2 ${s === "none" ? "text-muted" : s === "all" ? "font-medium text-primary" : ""}`}>{s === "none" ? "—" : t(`cell.${s}`)}</td>;
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
