import { notFound } from "next/navigation";
import { MergeCustomers } from "@/components/customers/merge-customers";
import { previewCustomers, previewScope } from "@/lib/preview";

export const metadata = { title: "Merge customers" };

export default async function PreviewMerge(props: PageProps<"/preview/[as]/customers/merge">) {
  const { as } = await props.params;
  const sp = await props.searchParams;
  if (previewScope(as, "contacts.merge") === "none") notFound();
  const { data, customers } = previewCustomers(as);
  const a = customers.find((x) => x.id === sp.a);
  const b = customers.find((x) => x.id === sp.b);
  if (!a || !b || a.id === b.id) notFound();
  return <MergeCustomers a={a} b={b} people={data.people} base={`/preview/${as}`} now={data.now} />;
}
