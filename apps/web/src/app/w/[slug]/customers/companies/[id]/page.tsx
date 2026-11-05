import { notFound } from "next/navigation";
import { CompanyPage } from "@/components/customers/company-page";
import { loadCustomers } from "@/lib/customers-live";
import { loadPeople } from "@/lib/viewer";
import { loadWorkspace } from "@/lib/workspace";
import { requestNow } from "@/lib/now";

/* One company on real data (step 2b): its details and the people linked to it. */
export default async function CompanyRoute(props: PageProps<"/w/[slug]/customers/companies/[id]">) {
  const { slug, id } = await props.params;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const [{ companies }, { people, viewer }] = await Promise.all([loadCustomers(supabase, workspace.id), loadPeople(supabase, workspace.id, me.id)]);
  const co = companies.find((x) => x.id === id);
  if (!co) notFound();
  return <CompanyPage key={co.id} co={co} people={people} viewer={viewer} now={requestNow()} base={`/w/${slug}`} />;
}
