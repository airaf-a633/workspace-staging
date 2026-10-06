import { notFound } from "next/navigation";
import { MergeCustomers } from "@/components/customers/merge-customers";
import { previewCustomers, previewScope } from "@/lib/preview";
import { getT, getTimeZone } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("merge"))("title") };
}

export default async function PreviewMerge(props: PageProps<"/preview/[as]/customers/merge">) {
  const { as } = await props.params;
  const tz = await getTimeZone();
  const sp = await props.searchParams;
  if (previewScope(as, "contacts.merge") === "none") notFound();
  const { data, customers } = previewCustomers(as, tz);
  const a = customers.find((x) => x.id === sp.a);
  const b = customers.find((x) => x.id === sp.b);
  if (!a || !b || a.id === b.id) notFound();
  return <MergeCustomers a={a} b={b} people={data.people} base={`/preview/${as}`} now={data.now} />;
}
