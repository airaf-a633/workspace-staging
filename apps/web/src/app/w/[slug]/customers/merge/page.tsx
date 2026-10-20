import { notFound } from "next/navigation";
import { MergeCustomersLive } from "@/components/customers/live";
import { getT } from "@/i18n/server";
import { loadCustomer } from "@/lib/customers-live";
import { loadPeople } from "@/lib/viewer";
import { loadWorkspace } from "@/lib/workspace";
import { requestNow } from "@/lib/now";

export async function generateMetadata() {
  return { title: (await getT("merge"))("title") };
}

/* Merging two real customers (step 2c): the person picks which values to keep; the database does the rest. */
export default async function MergeRoute(props: PageProps<"/w/[slug]/customers/merge">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const ids = [sp.a, sp.b].map((x) => (typeof x === "string" && /^[0-9a-f-]{36}$/.test(x) ? x : null));
  if (!ids[0] || !ids[1] || ids[0] === ids[1]) notFound();
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const [a, b, { people, viewer }] = await Promise.all([
    loadCustomer(supabase, workspace.id, ids[0]),
    loadCustomer(supabase, workspace.id, ids[1]),
    loadPeople(supabase, workspace.id, me.id),
  ]);
  if (!a || !b || (viewer.scopes["contacts.merge"] ?? "none") === "none") notFound();
  return <MergeCustomersLive slug={slug} a={a.customer} b={b.customer} people={people} base={`/w/${slug}`} now={requestNow()} />;
}
