import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { AccessForm } from "@/components/channels/access-form";
import { Notice } from "@/components/ui/surface";
import { getFormat, getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { requestAccess, type AccessChannel } from "@/app/w/[slug]/channels/access-actions";

/**
 * A channel that cannot be connected yet (TikTok, WeChat, Apple Messages): what it needs, in plain words, and a
 * "Request access" button that saves the request (decided 2026-11-02). What each page says comes from the platform's own
 * documentation where Relay could read it, and says so where it could not.
 */
export async function GatedChannelPage({ slug, channel, requested }: { slug: string; channel: AccessChannel; requested: boolean }) {
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("gatedChannels");
  const tAll = await getT();
  const fmt = await getFormat();
  const { data: existing } = await supabase.from("channel_access_requests").select("note, created_at").eq("workspace_id", workspace.id).eq("channel", channel).maybeSingle();
  const name = tAll(`channels.${channel}`);
  const needs = [t(`${channel}.need1`), t(`${channel}.need2`), t(`${channel}.need3`)];

  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels?add=1`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("title", { channel: name })} description={t(`${channel}.summary`)} />
      {requested && <Notice tone="success" title={t("requestedNow")}>{t("requestedNowBody")}</Notice>}
      {existing && !requested && <Notice tone="info" title={t("requestedOn", { date: fmt.shortDate(new Date(existing.created_at).getTime()) })} />}

      <section className="grid gap-3 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">
        <h2 className="font-semibold">{t("whyTitle")}</h2>
        <p className="text-sm">{t(`${channel}.why`)}</p>
        <h2 className="font-semibold">{t("needsTitle")}</h2>
        <ul className="grid list-disc gap-1.5 ps-5 text-sm">
          {needs.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>
      <Notice tone="warn" title={t("unsureTitle")}>{t(`${channel}.unsure`)}</Notice>
      <Notice tone="info" title={t("whatHappensTitle")}>{t("whatHappensBody", { channel: name })}</Notice>

      <AccessForm action={requestAccess} slug={slug} channel={channel} note={existing?.note ?? ""} requested={!!existing} />
    </SettingsFrame>
  );
}
