import { notFound } from "next/navigation";
import { conversationTimeline } from "@/components/customers/sample";
import { CustomerPageLive } from "@/components/customers/live";
import { getTimeZone } from "@/i18n/server";
import { loadCustomer, loadFieldDefs } from "@/lib/customers-live";
import { loadLiveInbox } from "@/lib/inbox-live";
import { loadPeople } from "@/lib/viewer";
import { loadWorkspace } from "@/lib/workspace";
import { requestNow } from "@/lib/now";

/* One customer on real data (step 2b): details, editing, and a timeline of what really happened (chats, notes, handovers). */
export default async function CustomerRoute(props: PageProps<"/w/[slug]/customers/[id]">) {
  const { slug, id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const tz = await getTimeZone();
  const [found, { people, teams, viewer }, fields] = await Promise.all([
    loadCustomer(supabase, workspace.id, id),
    loadPeople(supabase, workspace.id, me.id),
    loadFieldDefs(supabase, workspace.id),
  ]);
  if (!found) notFound();
  const inbox = await loadLiveInbox(supabase, workspace.id, people, teams, viewer, tz, id);
  const timeline = (inbox?.conversations ?? []).flatMap((c) => conversationTimeline(c, { people, tz })).sort((a, b) => b.at - a.at);
  return (
    <CustomerPageLive
      key={found.customer.id}
      slug={slug}
      c={{ ...found.customer, timeline }}
      duplicate={null}
      company={found.company}
      suggestedCompany={found.suggested}
      fields={fields}
      people={people}
      teams={teams}
      viewer={viewer}
      now={requestNow()}
      base={`/w/${slug}`}
      canEdit={(viewer.scopes["contacts.edit"] ?? "none") !== "none"}
      canMerge={false}
      canErase={false}
    />
  );
}
