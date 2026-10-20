import { redirect } from "next/navigation";
import { Billing } from "@/components/billing/billing";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { getT } from "@/i18n/server";
import { previewMembers, previewNow, previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("settings"))("billing") };
}

export default async function PreviewBilling(props: PageProps<"/preview/[as]/billing">) {
  const { as } = await props.params;
  if (previewScope(as, "billing.manage") === "none") redirect(`/preview/${as}/account`);
  const t = await getT("billing");
  return (
    <SettingsFrame base={`/preview/${as}`} active="billing" isOwner={previewScope(as, "members.manage") !== "none"}>
      <SectionHeader title={t("title")} description={t("description")} />
      <Billing activeMembers={previewMembers().length} now={previewNow()} />
    </SettingsFrame>
  );
}
