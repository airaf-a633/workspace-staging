import { CustomerListLive } from "@/components/customers/live";
import { getT } from "@/i18n/server";
import { loadCustomers } from "@/lib/customers-live";
import { loadPeople } from "@/lib/viewer";
import { loadWorkspace } from "@/lib/workspace";
import { requestNow } from "@/lib/now";

export async function generateMetadata() {
  return { title: (await getT("nav"))("customers") };
}

/* Contacts on real data (step 2b, decided 2026-10-20). Same screen as the preview; changes are saved. */
export default async function Customers(props: PageProps<"/w/[slug]/customers">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const [{ customers, companies }, { people, teams, viewer }] = await Promise.all([
    loadCustomers(supabase, workspace.id),
    loadPeople(supabase, workspace.id, me.id),
  ]);
  return (
    <CustomerListLive
      slug={slug}
      customers={customers}
      companies={companies}
      people={people}
      teams={teams}
      viewer={viewer}
      now={requestNow()}
      base={`/w/${slug}`}
      canEdit={(viewer.scopes["contacts.edit"] ?? "none") !== "none"}
      // Deleting and exporting come with step 2c.
      canBulkDelete={false}
      initialTab={sp.tab === "companies" ? "companies" : "people"}
    />
  );
}
