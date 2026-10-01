import { CustomerList } from "@/components/customers/customer-list";
import { previewCustomers, previewScope } from "@/lib/preview";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("nav"))("customers") };
}

export default async function PreviewCustomers(props: PageProps<"/preview/[as]/customers">) {
  const { as } = await props.params;
  const { data, customers } = previewCustomers(as);
  return (
    <CustomerList
      customers={customers}
      people={data.people}
      teams={data.teams}
      viewer={data.viewer}
      now={data.now}
      base={`/preview/${as}`}
      canEdit={previewScope(as, "contacts.edit") !== "none"}
    />
  );
}
