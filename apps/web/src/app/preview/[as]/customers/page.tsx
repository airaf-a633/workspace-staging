import { CustomerList } from "@/components/customers/customer-list";
import { previewCompanies, previewScope } from "@/lib/preview";
import { getT, getTimeZone } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("nav"))("customers") };
}

export default async function PreviewCustomers(props: PageProps<"/preview/[as]/customers">) {
  const { as } = await props.params;
  const sp = await props.searchParams;
  const tz = await getTimeZone();
  const { data, customers, companies } = previewCompanies(as, tz);
  return (
    <CustomerList
      customers={customers}
      companies={companies}
      people={data.people}
      teams={data.teams}
      viewer={data.viewer}
      now={data.now}
      base={`/preview/${as}`}
      canEdit={previewScope(as, "contacts.edit") !== "none"}
      canBulkDelete={previewScope(as, "data.bulk_export") !== "none"}
      initialTab={sp.tab === "companies" ? "companies" : "people"}
    />
  );
}
