import { Handshake } from "@phosphor-icons/react/dist/ssr";
import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon title="Deals" icon={<Handshake size={40} />} heading="No deals yet">
      Track sales from first message to won, in pipelines for each team.
    </ComingSoon>
  );
}
