import { notFound } from "next/navigation";
import { PERMISSIONS, ROLE_TEMPLATES } from "@app/domain";
import { Card } from "@/components/ui/surface";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { previewScope } from "@/lib/preview";

export const metadata = { title: "Roles and permissions" };

const LABEL: Record<string, string> = { none: "—", own: "Own", team: "Team", all: "All" };

export default async function PreviewRoles(props: PageProps<"/preview/[as]/roles">) {
  const { as } = await props.params;
  if (previewScope(as, "members.manage") === "none") notFound();

  return (
    <SettingsFrame base={`/preview/${as}`} active="roles" isOwner>
      <SectionHeader title="Roles" description="The six built-in roles are fixed. Make a custom role by copying one, then change what it can do." />
      <Card title="What each role can do" description="All = the whole workspace. Team = their teams. Own = what they hold or own.">
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="sticky start-0 bg-surface px-6 py-2 text-start font-medium">Permission</th>
                {ROLE_TEMPLATES.map((r) => <th key={r.key} scope="col" className="whitespace-nowrap px-3 py-2 text-start font-medium">{r.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.key} className="border-b border-border last:border-0">
                  <th scope="row" className="sticky start-0 bg-surface px-6 py-2 text-start font-normal">
                    {p.description}{p.ownerOnly && <span className="text-muted"> (owner only)</span>}
                  </th>
                  {p.scopes.map((s, i) => (
                    <td key={i} className={`px-3 py-2 ${s === "none" ? "text-muted" : s === "all" ? "font-medium text-primary" : ""}`}>{LABEL[s]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </SettingsFrame>
  );
}
