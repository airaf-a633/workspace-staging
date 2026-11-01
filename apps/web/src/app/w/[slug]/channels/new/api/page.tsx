import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { ApiCreateForm } from "@/components/channels/api-inbox";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { createApiInbox } from "../../api-actions";

export async function generateMetadata() {
  return { title: (await getT("apiSetup"))("addTitle") };
}

/* Adding an API inbox in a real workspace: a name, an optional address for replies, then the key (shown once). */
export default async function NewApiInbox(props: PageProps<"/w/[slug]/channels/new/api">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("apiSetup");
  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels?add=1`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("addTitle")} description={t("addHelp")} />
      <ApiCreateForm action={createApiInbox} slug={slug} />
    </SettingsFrame>
  );
}
