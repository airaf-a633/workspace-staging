import { ChatsCircle } from "@phosphor-icons/react/dist/ssr";
import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon title="Inbox" icon={<ChatsCircle size={40} />} heading="Your conversations will appear here">
      WhatsApp and email conversations with your customers, shared with your team. Connect a WhatsApp number to start.
    </ComingSoon>
  );
}
