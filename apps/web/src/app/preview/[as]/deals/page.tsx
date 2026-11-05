import { DealBoard } from "@/components/deals/deal-board";
import { previewDeals } from "@/lib/preview";
import { getT, getTimeZone } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("nav"))("deals") };
}

export default async function PreviewDeals(props: PageProps<"/preview/[as]/deals">) {
  const { as } = await props.params;
  const tz = await getTimeZone();
  const sp = await props.searchParams;
  const { data, deals } = previewDeals(as, tz);
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
