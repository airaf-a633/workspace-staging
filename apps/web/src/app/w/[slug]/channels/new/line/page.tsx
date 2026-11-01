import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { LineConnectForm } from "@/components/channels/line-forms";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { connectLine } from "../../line-actions";

export async function generateMetadata() {
  return { title: (await getT("lineSetup"))("addTitle") };
}

/* Adding a LINE account in a real workspace: copy two values from the LINE console, then paste Relay's address back. */
export default async function NewLine(props: PageProps<"/w/[slug]/channels/new/line">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("lineSetup");
  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels?add=1`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("addTitle")} description={t("addHelp")} />
      <Notice tone="info" title={t("costTitle")}>{t("costBody")}</Notice>
      <LineConnectForm action={connectLine} slug={slug} />
    </SettingsFrame>
  );
}
