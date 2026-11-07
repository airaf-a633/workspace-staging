import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { TelegramConnectForm } from "@/components/channels/telegram-forms";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { connectTelegram } from "../../telegram-actions";

export async function generateMetadata() {
  return { title: (await getT("telegramSetup"))("addTitle") };
}

/* Adding a Telegram bot in a real workspace: make a bot with BotFather, paste its token. */
export default async function NewTelegram(props: PageProps<"/w/[slug]/channels/new/telegram">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("telegramSetup");
  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels?add=1`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("addTitle")} description={t("addHelp")} />
      <TelegramConnectForm action={connectTelegram} slug={slug} />
    </SettingsFrame>
  );
}
