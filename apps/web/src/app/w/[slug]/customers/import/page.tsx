import { redirect } from "next/navigation";
import { ImportFlowLive } from "@/components/customers/live";
import { getT } from "@/i18n/server";
import { loadCustomers, loadFieldDefs } from "@/lib/customers-live";
import { loadPeople } from "@/lib/viewer";
import { loadWorkspace } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("importContacts"))("title") };
}

/* Importing a file into a real workspace (step 2c): fills blanks only, never overwrites. */
export default async function ImportRoute(props: PageProps<"/w/[slug]/customers/import">) {
  const { slug } = await props.params;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const [{ customers }, fields, { viewer }] = await Promise.all([
    loadCustomers(supabase, workspace.id),
    loadFieldDefs(supabase, workspace.id),
    loadPeople(supabase, workspace.id, me.id),
  ]);
  if ((viewer.scopes["contacts.edit"] ?? "none") === "none") redirect(`/w/${slug}/customers`);
  return <ImportFlowLive slug={slug} base={`/w/${slug}`} existing={customers} fields={fields} />;
}
