import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { XConnectForm } from "@/components/channels/x-forms";
import { CopyField } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/surface";
import { appOrigin } from "@/lib/app-origin";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { connectX } from "../../x-actions";

export async function generateMetadata() {
  return { title: (await getT("xSetup"))("addTitle") };
}

/** Adding X in a real workspace: the business's own X developer app, then a login as the account. */
export default async function NewX(props: PageProps<"/w/[slug]/channels/new/x">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("xSetup");
  const callback = `${await appOrigin()}/api/oauth/x/callback`;
  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels?add=1`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("addTitle")} description={t("addHelp")} />
      <Notice tone="warn" title={t("costTitle")}>{t("costBody")}</Notice>
      <Notice tone="info" title={t("limitsTitle")}>{t("limitsBody")}</Notice>
      <ol className="grid list-decimal gap-2 ps-5 text-sm sm:max-w-lg">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
        <li>{t("step4")}</li>
      </ol>
      <div className="grid gap-1.5 text-sm font-medium sm:max-w-lg">
        {t("callbackLabel")}
        <CopyField value={callback} label={t("callbackLabel")} />
        {!callback.startsWith("https://") && <span className="text-xs font-normal text-muted">{t("needHttpsNote")}</span>}
      </div>
      <XConnectForm action={connectX} slug={slug} />
    </SettingsFrame>
  );
}
