import { notFound } from "next/navigation";
import { CustomerPage } from "@/components/customers/customer-page";
import { CUSTOM_FIELDS } from "@/components/customers/sample";
import { getTimeZone } from "@/i18n/server";
import { previewCompanies, previewScope } from "@/lib/preview";

export async function generateMetadata(props: PageProps<"/preview/[as]/customers/[id]">) {
  const { as, id } = await props.params;
  return { title: previewCompanies(as, await getTimeZone()).customers.find((x) => x.id === id)?.name ?? "" };
}

export default async function PreviewCustomer(props: PageProps<"/preview/[as]/customers/[id]">) {
  const { as, id } = await props.params;
  const tz = await getTimeZone();
  const { data, customers, companies } = previewCompanies(as, tz);
  const c = customers.find((x) => x.id === id);
  if (!c) notFound();
  const duplicate = (c.duplicateOf && customers.find((x) => x.id === c.duplicateOf)) || null;
  return (
    <CustomerPage
      key={c.id}
      c={c}
      duplicate={duplicate}
      company={companies.find((x) => x.id === c.companyId) ?? null}
      suggestedCompany={companies.find((x) => x.id === c.companySuggestion) ?? null}
      fields={CUSTOM_FIELDS}
      people={data.people}
      teams={data.teams}
      viewer={data.viewer}
      now={data.now}
      base={`/preview/${as}`}
      canEdit={previewScope(as, "contacts.edit") !== "none"}
      canMerge={previewScope(as, "contacts.merge") !== "none"}
      canErase={previewScope(as, "contacts.erase") !== "none"}
    />
  );
}
