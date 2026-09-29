import { UsersThree } from "@phosphor-icons/react/dist/ssr";
import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon title="Customers" icon={<UsersThree size={40} />} heading="No customers yet">
      Everyone who messages you becomes a customer here, with their chats, deals and orders in one place. You&apos;ll also be able to import a spreadsheet.
    </ComingSoon>
  );
}
