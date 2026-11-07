import { DealBoard } from "@/components/deals/deal-board";
import { loadBoardDeals, loadCustomerChoices } from "@/lib/crm-live";
import { requestNow } from "@/lib/now";
import { loadPeople } from "@/lib/viewer";
import { loadWorkspace } from "@/lib/workspace";
import { getT, getTimeZone } from "@/i18n/server";
import { askDiscount, createDeal, decideDiscount, loseDeal, moveDeal, noteDeal, reopenDeal, winDeal } from "./actions";

export async function generateMetadata() {
  return { title: (await getT("nav"))("deals") };
}

/* Deals on real data (decided 2026-11-03). Row-level security decides which deals come back and whether each one carries its money. */
export default async function DealsPage(props: PageProps<"/w/[slug]/deals">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const tz = await getTimeZone();
  const now = requestNow();
  const [{ people, teams, viewer }, deals, customers] = await Promise.all([
    loadPeople(supabase, workspace.id, me.id),
    loadBoardDeals(supabase, workspace.id, tz, now),
    loadCustomerChoices(supabase, workspace.id),
  ]);
  // "New deal" on a customer's page arrives here with the customer already chosen.
  const newFor = typeof sp.new === "string" ? customers.find((c) => c.id === sp.new) ?? null : null;

  return (
    <DealBoard
      deals={deals}
      people={people.map(({ id, name, role, canReply }) => ({ id, name, role, canReply }))}
      teams={teams}
      viewer={viewer}
      now={now}
      base={`/w/${slug}`}
      initialOpen={typeof sp.deal === "string" ? sp.deal : null}
      live={{
        customers,
        newFor,
        create: createDeal.bind(null, slug),
        move: moveDeal.bind(null, slug),
        win: winDeal.bind(null, slug),
        lose: loseDeal.bind(null, slug),
        reopen: reopenDeal.bind(null, slug),
        note: noteDeal.bind(null, slug),
        askDiscount: askDiscount.bind(null, slug),
        decide: decideDiscount.bind(null, slug),
      }}
    />
  );
}
