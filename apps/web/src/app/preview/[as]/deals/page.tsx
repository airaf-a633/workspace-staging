import { DealBoard } from "@/components/deals/deal-board";
import { previewDeals } from "@/lib/preview";

export const metadata = { title: "Deals" };

export default async function PreviewDeals(props: PageProps<"/preview/[as]/deals">) {
  const { as } = await props.params;
  const sp = await props.searchParams;
  const { data, deals } = previewDeals(as);
  return (
    <DealBoard
      deals={deals}
      people={data.people}
      teams={data.teams}
      viewer={data.viewer}
      now={data.now}
      base={`/preview/${as}`}
      initialOpen={typeof sp.deal === "string" ? sp.deal : null}
    />
  );
}
