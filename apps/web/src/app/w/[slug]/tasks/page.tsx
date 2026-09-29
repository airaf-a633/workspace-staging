import { CheckSquare } from "@phosphor-icons/react/dist/ssr";
import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon title="Tasks" icon={<CheckSquare size={40} />} heading="Nothing to do yet">
      Follow-ups, calls and deliveries with due dates, linked to the customer they&apos;re for.
    </ComingSoon>
  );
}
