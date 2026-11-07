import { redirect } from "next/navigation";
import { ImportFlow } from "@/components/customers/import-flow";
import { CUSTOM_FIELDS } from "@/components/customers/sample";
import { getT, getTimeZone } from "@/i18n/server";
import { previewCustomers, previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("importContacts"))("title") };
}

export default async function PreviewImport(props: PageProps<"/preview/[as]/customers/import">) {
  const { as } = await props.params;
  if (previewScope(as, "contacts.edit") === "none") redirect(`/preview/${as}/customers`);
  const { customers } = previewCustomers(as, await getTimeZone());
  return <ImportFlow base={`/preview/${as}`} existing={customers} fields={CUSTOM_FIELDS} />;
}
