import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/surface";
import { serverEnv } from "@/env";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("slackSetup"))("addTitle") };
}

/** Adding Slack in a real workspace: one button that sends the person to Slack to approve Relay. */
export default async function NewSlack(props: PageProps<"/w/[slug]/channels/new/slack">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("slackSetup");
  const env = serverEnv();
  const configured = !!env.SLACK_CLIENT_ID && !!env.SLACK_CLIENT_SECRET && !!env.SLACK_SIGNING_SECRET;
  const error = typeof sp.error === "string" ? sp.error : null;
  const problems = {
    declined: "errors.declined", unreachable: "errors.unreachable", otherAccount: "errors.otherAccount", notAllowed: "errors.notAllowed", notConfigured: "errors.notConfigured",
  } as const;
  const problem = error ? (error in problems ? problems[error as keyof typeof problems] : "errors.failed") : null;
  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels?add=1`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("addTitle")} description={t("addHelp")} />
      {problem && <Notice tone="error" title={t(problem)} />}
      {!configured && <Notice tone="warn" title={t("errors.notConfigured")} />}
      <ol className="grid list-decimal gap-2 ps-5 text-sm sm:max-w-lg">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
      </ol>
      <Notice tone="info" title={t("whoTitle")}>{t("whoBody")}</Notice>
      <div>
        {/* A plain link, not a client-side one: the next page is Slack's own. */}
        <a href={configured ? `/api/oauth/slack/start?slug=${encodeURIComponent(slug)}` : undefined} aria-disabled={!configured} className={buttonClass("primary", "md")}>
          {t("add")}
        </a>
      </div>
    </SettingsFrame>
  );
}
