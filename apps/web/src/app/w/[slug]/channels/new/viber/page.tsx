import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { ViberConnectForm } from "@/components/channels/viber-forms";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { connectViber } from "../../viber-actions";

export async function generateMetadata() {
  return { title: (await getT("viberSetup"))("addTitle") };
}

/** Adding Viber in a real workspace: a bot the business already has, by its token. */
export default async function NewViber(props: PageProps<"/w/[slug]/channels/new/viber">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("viberSetup");
  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels?add=1`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("addTitle")} description={t("addHelp")} />
      <Notice tone="warn" title={t("contractTitle")}>{t("contractBody")}</Notice>
      <ViberConnectForm action={connectViber} slug={slug} />
    </SettingsFrame>
  );
}
