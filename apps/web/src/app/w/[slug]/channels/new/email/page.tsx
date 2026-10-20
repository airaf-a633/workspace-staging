import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GoogleLogo, MicrosoftOutlookLogo } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { EmailForm } from "@/components/channels/email-form";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { createEmailChannel } from "../../email-actions";

export async function generateMetadata() {
  return { title: (await getT("emailSetup"))("addTitle") };
}

const ERRORS = ["needName", "badAddress", "notAllowed"] as const;

/* Adding an email channel: the business's address and how replies look, then the forwarding steps. */
export default async function NewEmail(props: PageProps<"/w/[slug]/channels/new/email">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("emailSetup");
  const error = typeof sp.error === "string" ? (ERRORS.find((e) => e === sp.error) ?? "failed") : null;

  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels?add=1`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("addTitle")} description={t("addHelp")} />
      {error && <Notice tone="error" title={t(`errors.${error}`)} />}
      <Link href={`/w/${slug}/channels/new/outlook`} className="flex w-fit items-center gap-3 rounded-[var(--radius-panel)] bg-surface p-4 shadow-[var(--shadow-1)] ring-1 ring-border hover:bg-surface-2">
        <MicrosoftOutlookLogo size={28} className="text-primary" aria-hidden="true" />
        <span className="grid"><span className="font-medium">{t("useOutlook")}</span><span className="text-sm text-muted">{t("useOutlookHelp")}</span></span>
      </Link>
      <Link href={`/w/${slug}/channels/new/gmail`} className="flex w-fit items-center gap-3 rounded-[var(--radius-panel)] bg-surface p-4 shadow-[var(--shadow-1)] ring-1 ring-border hover:bg-surface-2">
        <GoogleLogo size={28} weight="bold" className="text-primary" aria-hidden="true" />
        <span className="grid"><span className="font-medium">{t("useGmail")}</span><span className="text-sm text-muted">{t("useGmailHelp")}</span></span>
      </Link>
      <h2 className="font-semibold">{t("orForward")}</h2>
      <EmailForm action={createEmailChannel} slug={slug} initial={{ name: t("defaultName"), address: "", fromName: workspace.name, signature: "" }} submit={t("create")} />
    </SettingsFrame>
  );
}
