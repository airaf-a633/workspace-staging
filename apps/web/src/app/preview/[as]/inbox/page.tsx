import { Suspense } from "react";
import { Inbox } from "@/components/inbox/inbox";
import { previewInbox } from "@/lib/preview";

export const metadata = { title: "Inbox" };

export default async function PreviewInbox(props: PageProps<"/preview/[as]/inbox">) {
  const { as } = await props.params;
  return (
    <Suspense>
      <Inbox data={previewInbox(as)} />
    </Suspense>
  );
}
