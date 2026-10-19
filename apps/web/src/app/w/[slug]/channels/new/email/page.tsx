import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
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
      <EmailForm action={createEmailChannel} slug={slug} initial={{ name: t("defaultName"), address: "", fromName: workspace.name, signature: "" }} submit={t("create")} />
    </SettingsFrame>
  );
}
