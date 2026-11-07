import { notFound } from "next/navigation";
import { CampaignBuilder } from "@/components/campaigns/campaign-builder";
import { CampaignDetail } from "@/components/campaigns/campaign-views";
import { CAMPAIGNS } from "@/components/campaigns/sample";
import { PreviewNotice } from "@/components/preview-notice";
import { getT } from "@/i18n/server";
import { loadWorkspace, scopeOf } from "@/lib/workspace";

export async function generateMetadata(props: PageProps<"/w/[slug]/campaigns/[id]">) {
  const { id } = await props.params;
  return { title: CAMPAIGNS.find((c) => c.id === id)?.name ?? (await getT("campaignsPage"))("new") };
}

export default async function Campaign(props: PageProps<"/w/[slug]/campaigns/[id]">) {
  const { slug, id } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  const [manage, segments, imported] = await Promise.all([
    scopeOf(workspace.id, "campaigns.manage"),
    scopeOf(workspace.id, "campaigns.send_segments"),
    scopeOf(workspace.id, "campaigns.send_imported"),
  ]);
  const canCreate = manage !== "none";
  const canSend = segments !== "none";
  const canApprove = imported === "all";
  if (!canCreate && !canApprove) notFound();
  const base = `/w/${slug}`;
  const c = id === "new" ? null : CAMPAIGNS.find((x) => x.id === id);
  if (c === undefined) notFound();
  return (
    <>
      <PreviewNotice />
      {c === null ? <CampaignBuilder base={base} canApprove={canApprove} canSend={canSend} /> : <CampaignDetail key={c.id} base={base} c={c} canApprove={canApprove} />}
    </>
  );
}
