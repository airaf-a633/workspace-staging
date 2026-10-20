import { ContactSettings } from "@/components/customers/contact-settings";
import { CUSTOM_FIELDS } from "@/components/customers/sample";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { getT, getTimeZone } from "@/i18n/server";
import { previewCustomers, previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("settings"))("contacts") };
}

export default async function PreviewContactSettings(props: PageProps<"/preview/[as]/contact-settings">) {
  const { as } = await props.params;
  const t = await getT("contactSettings");
  const { customers } = previewCustomers(as, await getTimeZone());
  return (
    <SettingsFrame base={`/preview/${as}`} active="contacts" isOwner={previewScope(as, "members.manage") !== "none"}>
      <SectionHeader title={t("title")} description={t("description")} />
      <ContactSettings
        initialFields={CUSTOM_FIELDS}
        tags={[...new Set(customers.flatMap((c) => c.tags))].sort()}
        canFields={previewScope(as, "crm.settings") !== "none"}
        canRetention={previewScope(as, "data.bulk_export") !== "none"}
      />
    </SettingsFrame>
  );
}
