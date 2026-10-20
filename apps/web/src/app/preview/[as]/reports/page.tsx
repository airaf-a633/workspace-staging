import { redirect } from "next/navigation";
import { Reports } from "@/components/reports/reports";
import { getT, getTimeZone } from "@/i18n/server";
import { PREVIEW_TEAMS, previewInbox, previewPerson, previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("reports"))("title") };
}

export default async function PreviewReports(props: PageProps<"/preview/[as]/reports">) {
  const { as } = await props.params;
  const scope = previewScope(as, "reports.view");
  if (scope === "none") redirect(`/preview/${as}`);
  const me = previewPerson(as);
  const data = previewInbox(as, await getTimeZone());
  // Sample people work in Sales or Support; the owner and admin stay out of the agent tables.
  const agents = data.people
    .filter((p) => !["Owner", "Admin", "Viewer"].includes(p.role))
    .map((p) => ({ id: p.id, name: p.name, team: /support/i.test(p.role) ? "t-support" : /sales/i.test(p.role) ? "t-sales" : p.name === "Leo" ? "t-sales" : "t-support" }));
  return (
    <Reports
      agents={agents}
      teams={PREVIEW_TEAMS.filter((x) => !x.isDefault).map(({ id, name }) => ({ id, name }))}
      teamScope={scope === "all" ? "all" : "team"}
      myTeams={me.teams}
      canMoney={previewScope(as, "deals.values") !== "none"}
      canExport={previewScope(as, "reports.export") !== "none"}
      now={data.now}
    />
  );
}
