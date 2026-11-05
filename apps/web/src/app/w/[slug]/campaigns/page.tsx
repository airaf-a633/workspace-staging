import { notFound } from "next/navigation";
import { CampaignList } from "@/components/campaigns/campaign-views";
import { PreviewNotice } from "@/components/preview-notice";
import { getT } from "@/i18n/server";
import { loadWorkspace, scopeOf } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("campaignsPage"))("title") };
}

/* Campaigns in a real workspace: the designed screen with sample data, labelled as a preview (2026-11-03). Nothing is sent. */
export default async function Campaigns(props: PageProps<"/w/[slug]/campaigns">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  const [manage, imported] = await Promise.all([scopeOf(workspace.id, "campaigns.manage"), scopeOf(workspace.id, "campaigns.send_imported")]);
  const canCreate = manage !== "none";
  const canApprove = imported === "all";
  if (!canCreate && !canApprove) notFound();
  return (
    <>
      <PreviewNotice />
      <CampaignList base={`/w/${slug}`} canCreate={canCreate} canApprove={canApprove} />
    </>
  );
}
