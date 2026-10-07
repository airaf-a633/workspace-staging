import { notFound, redirect } from "next/navigation";
import { CampaignBuilder } from "@/components/campaigns/campaign-builder";
import { CampaignDetail } from "@/components/campaigns/campaign-views";
import { CAMPAIGNS } from "@/components/campaigns/sample";
import { getT } from "@/i18n/server";
import { previewScope } from "@/lib/preview";

export async function generateMetadata(props: PageProps<"/preview/[as]/campaigns/[id]">) {
  const { id } = await props.params;
  return { title: CAMPAIGNS.find((c) => c.id === id)?.name ?? (await getT("campaignsPage"))("new") };
}

// Create with campaigns.manage; send to segments with campaigns.send_segments; approve big sends as owner or admin.
const perms = (as: string) => ({
  canCreate: previewScope(as, "campaigns.manage") !== "none",
  canSend: previewScope(as, "campaigns.send_segments") !== "none",
  canApprove: previewScope(as, "campaigns.send_imported") === "all",
});

export default async function PreviewCampaign(props: PageProps<"/preview/[as]/campaigns/[id]">) {
  const { as, id } = await props.params;
  const p = perms(as);
  if (!p.canCreate && !p.canApprove) redirect(`/preview/${as}`);
  const base = `/preview/${as}`;
  if (id === "new") return <CampaignBuilder base={base} canApprove={p.canApprove} canSend={p.canSend} />;
  const c = CAMPAIGNS.find((x) => x.id === id);
  if (!c) notFound();
  return <CampaignDetail key={c.id} base={base} c={c} canApprove={p.canApprove} />;
}
