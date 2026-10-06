import { getTimeZone } from "@/i18n/server";
import { notFound } from "next/navigation";
import { CustomerPage } from "@/components/customers/customer-page";
import { previewCustomers, previewScope } from "@/lib/preview";

export default async function PreviewCustomer(props: PageProps<"/preview/[as]/customers/[id]">) {
  const { as, id } = await props.params;
  const tz = await getTimeZone();
  const { data, customers } = previewCustomers(as, tz);
  const c = customers.find((x) => x.id === id);
  if (!c) notFound();
  const duplicate = (c.duplicateOf && customers.find((x) => x.id === c.duplicateOf)) || null;
  return (
    <CustomerPage
      c={c}
      duplicate={duplicate}
      people={data.people}
      teams={data.teams}
      viewer={data.viewer}
      now={data.now}
      base={`/preview/${as}`}
      canMerge={previewScope(as, "contacts.merge") !== "none"}
      canErase={previewScope(as, "contacts.erase") !== "none"}
    />
  );
}
