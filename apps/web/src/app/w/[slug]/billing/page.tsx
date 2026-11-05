import { notFound } from "next/navigation";
import { Billing } from "@/components/billing/billing";
import { PreviewNotice } from "@/components/preview-notice";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { getT } from "@/i18n/server";
import { requestNow } from "@/lib/now";
import { can, loadWorkspace } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("settings"))("billing") };
}

/* Billing in a real workspace: the designed screen, labelled as a preview (2026-11-03). Nothing is charged and no card is taken. */
export default async function BillingPage(props: PageProps<"/w/[slug]/billing">) {
  const { slug } = await props.params;
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "billing.manage"))) notFound();
  const t = await getT("billing");
  const { count } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "active");
  return (
    <SettingsFrame base={`/w/${slug}`} active="billing" isOwner={await can(workspace.id, "members.manage")}>
      <PreviewNotice />
      <SectionHeader title={t("title")} description={t("description")} />
      <Billing activeMembers={count ?? 1} now={requestNow()} />
    </SettingsFrame>
  );
}
