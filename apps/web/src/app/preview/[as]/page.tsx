import { covers } from "@app/domain";
import { ManagerHome, type NeedRow } from "@/components/home/manager-home";
import { previewDeals, previewPerson } from "@/lib/preview";
import { getT } from "@/i18n/server";
import { AgentBriefings } from "@/components/ai/briefings";
import { previewAiWorld } from "@/lib/ai-sample";
import { isolate } from "@/i18n/translate";

export async function generateMetadata() {
  return { title: (await getT("nav"))("home") };
}

export default async function PreviewHome(props: PageProps<"/preview/[as]">) {
  const { as } = await props.params;
  const me = previewPerson(as);
  const { data, deals } = previewDeals(as);
  const t = await getT("home");
  const common = await getT("common");
  const name = (id: string) => data.people.find((p) => p.id === id)?.name ?? common("someone");

  // Discount approvals waiting for this person (decided 2026-09-30: on the card and in Needs you now).
  const approvals: NeedRow[] = deals
    .filter((d) => d.approval?.status === "pending" && d.approval.byId !== me.id && covers(data.viewer, "deals.approve", { teamId: d.teamId, holderId: d.ownerId }))
    .map((d) => ({
      id: `approve-${d.id}`,
      name: d.customerName,
      href: `/preview/${as}/deals?deal=${d.id}`,
      tone: "warn",
      rank: 1,
      waitingSince: null,
      meta: t("approval"),
      // The deal title is someone's own words: isolated so "8 x iPad…" keeps its order in an Arabic row.
      items: [t("approveAsk", { name: name(d.approval!.byId), pct: d.approval!.pct }), isolate(d.title)],
    }));

  // The sample business has connected WhatsApp and invited its team; hours, import and store are still open.
  const setup = me.template === "owner" ? { done: 2, total: 5, href: `/preview/${as}/account` } : undefined;
  return <ManagerHome firstName={me.name} template={me.template} data={data} inboxHref={`/preview/${as}/inbox`} setup={setup} extraNeeds={approvals} briefings={<AgentBriefings world={previewAiWorld(as)} />} />;
}
