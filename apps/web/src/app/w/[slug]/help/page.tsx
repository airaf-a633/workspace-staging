import { notFound } from "next/navigation";
import { HelpAdmin } from "@/components/help/help-admin";
import { PreviewNotice } from "@/components/preview-notice";
import { getT } from "@/i18n/server";
import { loadWorkspace, scopeOf } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("helpCenter"))("title") };
}

/* Help Center in a real workspace: the designed screen with sample articles, labelled as a preview (2026-11-03). Nothing is published. */
export default async function Help(props: PageProps<"/w/[slug]/help">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  const [use, manage] = await Promise.all([scopeOf(workspace.id, "canned.use"), scopeOf(workspace.id, "canned.manage")]);
  if (use === "none") notFound();
  return (
    <>
      <PreviewNotice />
      <HelpAdmin base={`/w/${slug}`} canPublish={manage !== "none"} />
    </>
  );
}
