import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { VoiceConnectForm } from "@/components/channels/voice-forms";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { connectVoice } from "../../voice-actions";

export async function generateMetadata() {
  return { title: (await getT("voiceSetup"))("addTitle") };
}

/** Adding a phone line in a real workspace: the customer's own Twilio account and one of its numbers. */
export default async function NewVoice(props: PageProps<"/w/[slug]/channels/new/voice">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("voiceSetup");
  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels?add=1`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("addTitle")} description={t("addHelp")} />
      <Notice tone="info" title={t("recordingTitle")}>{t("recordingBody")}</Notice>
      <Notice tone="info" title={t("costTitle")}>{t("costBody")}</Notice>
      <VoiceConnectForm action={connectVoice} slug={slug} />
    </SettingsFrame>
  );
}
