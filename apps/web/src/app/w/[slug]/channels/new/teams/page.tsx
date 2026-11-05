import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { TeamsConnectForm } from "@/components/channels/teams-forms";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { connectTeams } from "../../teams-actions";

export async function generateMetadata() {
  return { title: (await getT("teamsSetup"))("addTitle") };
}

/** Adding Microsoft Teams in a real workspace: the company's own bot, by its Azure details. */
export default async function NewTeams(props: PageProps<"/w/[slug]/channels/new/teams">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("teamsSetup");
  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels?add=1`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("addTitle")} description={t("addHelp")} />
      <Notice tone="info" title={t("whoTitle")}>{t("whoBody")}</Notice>
      <Notice tone="warn" title={t("adminTitle")}>{t("adminBody")}</Notice>
      <TeamsConnectForm action={connectTeams} slug={slug} />
    </SettingsFrame>
  );
}
