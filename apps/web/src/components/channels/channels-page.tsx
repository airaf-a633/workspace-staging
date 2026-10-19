import Link from "next/link";
import { ArrowLeft, CaretRight, Plus, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { buttonClass } from "@/components/ui/button";
import type { ChannelInbox } from "@/components/inbox/types";
import { getT } from "@/i18n/server";
import { ChannelMark } from "./channel-mark";
import { CHANNELS, type ChannelGroup, type ChannelKey } from "./catalog";

const GROUPS: ChannelGroup[] = ["messaging", "social", "web", "work", "developer"];
/** What most businesses connect first; the rest of the catalogue is one click deeper (simplicity pass 2026-10-19). */
const POPULAR: ChannelKey[] = ["whatsapp", "email", "webchat", "instagram", "messenger"];
/** Channels a real workspace can connect today. */
const LIVE_CHANNELS: ChannelKey[] = ["whatsapp", "webchat"];

/**
 * Settings › Channels (decided 2026-10-07): the channels you've connected first, with their health and where
 * new conversations go, then every channel Relay supports, grouped, each with Connect.
 * Owners and admins manage channels; everyone else sees them read-only.
 * Simplicity pass (2026-10-19): the page lists only what's connected; adding a channel is its own view (?add=1)
 * with the five most-used channels first. A workspace with nothing connected starts there.
 */
export async function ChannelsPage({
  base,
  inboxes,
  teamOf,
  canManage,
  isOwner,
  live = false,
  adding = false,
}: {
  base: string;
  inboxes: ChannelInbox[];
  /** Team name that receives each inbox's new conversations. */
  teamOf: Record<string, string>;
  canManage: boolean;
  isOwner: boolean;
  /** The real workspace: WhatsApp and website chat connect for real so far; the rest show as coming soon. */
  live?: boolean;
  /** Show the "add a channel" view instead of the list. */
  adding?: boolean;
}) {
  const t = await getT("channelsPage");
  const o = await getT("omni");
  const tAll = await getT();
  const common = await getT("common");
  const connected = (key: string) => inboxes.filter((i) => i.channel === key).length;
  const showAdd = canManage && (adding || inboxes.length === 0);

  const tile = (c: (typeof CHANNELS)[number], wide: boolean) => {
    const n = connected(c.key);
    return (
      <li key={c.key} className={`flex items-start gap-3 bg-surface p-4 ${wide ? "sm:col-span-2" : ""}`}>
        <ChannelMark ch={c.key} size={36} label={false} />
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {tAll(`channels.${c.key}`)}
            {n > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-normal text-muted">{t("connectedN", { count: n })}</span>}
          </span>
          <span className="text-sm text-muted">{t(`desc.${c.key}`)}</span>
          {c.review && <span className="text-xs text-muted">{t(`review.${c.review}`)}</span>}
        </span>
        {live && !LIVE_CHANNELS.includes(c.key) ? (
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{common("soon")}</span>
        ) : (
          <Link href={live && c.key === "whatsapp" ? `${base}/whatsapp` : `${base}/channels/new/${c.key}`} className={buttonClass(n > 0 ? "ghost" : "secondary", "sm", "shrink-0")} aria-label={t("connectAria", { channel: tAll(`channels.${c.key}`) })}>
            {n > 0 ? t("connectAnother") : t("connect")}
          </Link>
        )}
      </li>
    );
  };

  if (showAdd) {
    const popular = POPULAR.map((k) => CHANNELS.find((c) => c.key === k)!).filter(Boolean);
    return (
      <SettingsFrame base={base} active="channels" isOwner={isOwner}>
        <div className="grid gap-2">
          {inboxes.length > 0 && (
            <Link href={`${base}/channels`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
              <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("backToList")}
            </Link>
          )}
          <SectionHeader title={t("addTitle")} description={t("addHelp")} />
        </div>
        <section className="grid gap-2" aria-labelledby="ch-popular">
          <h2 id="ch-popular" className="text-sm font-medium text-muted">{t("popular")}</h2>
          <ul className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border bg-border sm:grid-cols-2">
            {popular.map((c, k) => tile(c, k === popular.length - 1 && popular.length % 2 === 1))}
          </ul>
        </section>
        <details className="group grid gap-6">
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 font-medium text-primary [&::-webkit-details-marker]:hidden">
            <Plus size={16} className="transition-transform group-open:rotate-45" aria-hidden="true" /> {t("seeAll", { count: CHANNELS.length })}
          </summary>
          <div className="mt-4 grid gap-6">
            {GROUPS.map((g) => {
              const list = CHANNELS.filter((c) => c.group === g && !POPULAR.includes(c.key));
              if (list.length === 0) return null;
              return (
                <div key={g} className="grid gap-2">
                  <h3 className="text-sm font-medium text-muted">{t(`groups.${g}`)}</h3>
                  <ul className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border bg-border sm:grid-cols-2">
                    {list.map((c, k) => tile(c, k === list.length - 1 && list.length % 2 === 1))}
                  </ul>
                </div>
              );
            })}
          </div>
        </details>
      </SettingsFrame>
    );
  }

  return (
    <SettingsFrame base={base} active="channels" isOwner={isOwner}>
      <SectionHeader title={t("title")} description={t("description")} />
      {!canManage && <p className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm text-muted">{t("readOnly")}</p>}

      <section className="grid gap-3" aria-labelledby="ch-connected">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ch-connected" className="text-lg font-semibold">{t("connected", { count: inboxes.length })}</h2>
          {canManage && <Link href={`${base}/channels?add=1`} className={buttonClass("primary", "sm")}><Plus size={16} aria-hidden="true" /> {t("add")}</Link>}
        </div>
        {inboxes.length === 0 ? (
          <p className="rounded-[var(--radius-panel)] border border-dashed border-border p-6 text-center text-muted">{t("none")}</p>
        ) : (
          <ul className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
            {inboxes.map((i) => (
              <li key={i.id} className="border-b border-border last:border-0">
                <Link href={live && i.channel === "whatsapp" ? `${base}/whatsapp` : `${base}/channels/${i.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
                  <ChannelMark ch={i.channel} size={32} label={tAll(`channels.${i.channel}`)} />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <bdi className="font-medium">{i.name}</bdi>
                      {i.broken ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-fail-soft px-2 py-0.5 text-xs font-medium text-fail">
                          <WarningCircle size={14} weight="fill" aria-hidden="true" /> {t("status.broken")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-done-soft px-2 py-0.5 text-xs font-medium">
                          <span className="size-1.5 rounded-full bg-done" aria-hidden="true" /> {t("status.ok")}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-sm text-muted">
                      <span dir="ltr">{i.address}</span>
                      {teamOf[i.id] && <> · {t("routes", { team: teamOf[i.id] })}</>}
                    </span>
                    {i.broken && <span className="text-sm text-fail">{o(`broken.${i.broken}`, { inbox: i.name })}</span>}
                  </span>
                  <CaretRight size={18} className="shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

    </SettingsFrame>
  );
}
