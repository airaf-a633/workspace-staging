import { Suspense } from "react";
import { Inbox } from "@/components/inbox/inbox";
import { previewInbox, previewScope } from "@/lib/preview";
import { getT, getTimeZone } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("nav"))("inbox") };
}

export default async function PreviewInbox(props: PageProps<"/preview/[as]/inbox">) {
  const { as } = await props.params;
  const tz = await getTimeZone();
  return (
    <Suspense>
      <Inbox data={previewInbox(as, tz)} connectHref={previewScope(as, "numbers.manage") !== "none" ? `/preview/${as}/channels#add` : undefined} />
    </Suspense>
  );
}
