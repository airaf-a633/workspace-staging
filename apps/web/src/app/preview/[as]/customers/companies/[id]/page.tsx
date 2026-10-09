import { notFound } from "next/navigation";
import { CompanyPage } from "@/components/customers/company-page";
import { getTimeZone } from "@/i18n/server";
import { previewCompanies } from "@/lib/preview";

export async function generateMetadata(props: PageProps<"/preview/[as]/customers/companies/[id]">) {
  const { as, id } = await props.params;
  return { title: previewCompanies(as, await getTimeZone()).companies.find((x) => x.id === id)?.name ?? "" };
}

export default async function PreviewCompany(props: PageProps<"/preview/[as]/customers/companies/[id]">) {
  const { as, id } = await props.params;
  const { data, companies } = previewCompanies(as, await getTimeZone());
  const co = companies.find((x) => x.id === id);
  if (!co) notFound();
  return <CompanyPage key={co.id} co={co} people={data.people} viewer={data.viewer} now={data.now} base={`/preview/${as}`} />;
}
