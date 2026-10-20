import { redirect } from "next/navigation";
import { HelpAdmin } from "@/components/help/help-admin";
import { getT } from "@/i18n/server";
import { previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("helpCenter"))("title") };
}

/* Anyone who uses saved replies drafts articles; managers publish (decided 2026-10-07). */
export default async function PreviewHelp(props: PageProps<"/preview/[as]/help">) {
  const { as } = await props.params;
  if (previewScope(as, "canned.use") === "none") redirect(`/preview/${as}`);
  return <HelpAdmin base={`/preview/${as}`} canPublish={previewScope(as, "canned.manage") !== "none"} />;
}
