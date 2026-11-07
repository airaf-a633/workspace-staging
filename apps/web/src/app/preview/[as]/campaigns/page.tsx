import { redirect } from "next/navigation";
import { CampaignList } from "@/components/campaigns/campaign-views";
import { getT } from "@/i18n/server";
import { previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("campaignsPage"))("title") };
}

// Create with campaigns.manage; send to segments with campaigns.send_segments; approve big sends as owner or admin.
const perms = (as: string) => ({
  canCreate: previewScope(as, "campaigns.manage") !== "none",
  canSend: previewScope(as, "campaigns.send_segments") !== "none",
  canApprove: previewScope(as, "campaigns.send_imported") === "all",
});

export default async function PreviewCampaigns(props: PageProps<"/preview/[as]/campaigns">) {
  const { as } = await props.params;
  const p = perms(as);
  if (!p.canCreate && !p.canApprove) redirect(`/preview/${as}`);
  return <CampaignList base={`/preview/${as}`} canCreate={p.canCreate} canApprove={p.canApprove} />;
}
