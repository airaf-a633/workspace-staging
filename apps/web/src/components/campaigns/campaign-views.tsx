"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle, Info, Plus, Trophy } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { ChannelMark } from "@/components/channels/channel-mark";
import { useFormat, useT } from "@/i18n/client";
import { APPROVAL_OVER, CAMPAIGNS, SEGMENTS, audience, type Campaign, type CampaignStatus } from "./sample";

/* Campaigns list and one campaign's page (decided 2026-10-07). */

const TONE: Record<CampaignStatus, "new" | "warn" | "transit" | "done"> = { draft: "new", approval: "warn", scheduled: "transit", sent: "done" };
type Tab = "all" | "drafts" | "scheduled" | "sent";

export function CampaignList({ base, canCreate, canApprove }: { base: string; canCreate: boolean; canApprove: boolean }) {
  const t = useT("campaignsPage");
  const tAll = useT();
  const fmt = useFormat();
  const [tab, setTab] = useState<Tab>("all");
  const list = CAMPAIGNS.filter((c) => tab === "all" || (tab === "drafts" ? c.status === "draft" || c.status === "approval" : c.status === tab));
  const waiting = CAMPAIGNS.filter((c) => c.status === "approval").length;
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="title text-3xl">{t("title")}</h1>
        {canCreate && <Link href={`${base}/campaigns/new`} className={buttonClass("primary", "sm")}><Plus size={16} aria-hidden="true" /> {t("new")}</Link>}
      </header>
      {canApprove && waiting > 0 && (
        <p className="flex items-center gap-2 rounded-[var(--radius-control)] bg-warn-soft px-4 py-2.5 text-sm"><Info size={16} aria-hidden="true" />{t("waitingApproval", { count: waiting })}</p>
      )}
      <div role="tablist" aria-label={t("title")} className="flex gap-5 border-b border-border">
        {(["all", "drafts", "scheduled", "sent"] as const).map((k) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px min-h-10 border-b-2 text-sm font-medium ${tab === k ? "border-primary text-text" : "border-transparent text-muted hover:text-text"}`}>{t(`tabs.${k}`)}</button>
        ))}
      </div>
      <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface ring-1 ring-border">
        {list.map((c) => {
          const seg = SEGMENTS.find((s) => s.id === c.segment)!;
          return (
            <li key={c.id} className="border-b border-border last:border-0">
              <Link href={`${base}/campaigns/${c.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface-2">
                <ChannelMark ch={c.channel} size={32} label={tAll(`channels.${c.channel}`)} />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.name}</span><Badge tone={TONE[c.status]}>{t(`status.${c.status}`)}</Badge></span>
                  <span className="truncate text-sm text-muted">{seg.name} · {c.status === "sent" ? t("sentAgo", { count: -c.when }) : c.status === "scheduled" ? t("sendsIn", { count: c.when, time: c.localTime ?? "" }) : t("by", { name: c.createdBy })}</span>
                </span>
                {c.results && (
                  <span className="grid grid-cols-3 gap-6 text-end text-sm tabular-nums">
                    <span className="grid"><span>{fmt.number(c.results.sent)}</span><span className="text-xs text-muted">{t("metrics.sent")}</span></span>
                    <span className="grid"><span>{fmt.number(c.results.replied)}</span><span className="text-xs text-muted">{t("metrics.replied")}</span></span>
                    <span className="grid"><span>{fmt.number(c.results.orders)}</span><span className="text-xs text-muted">{t("metrics.orders")}</span></span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Funnel({ c }: { c: Campaign }) {
  const t = useT("campaignsPage");
  const fmt = useFormat();
  const r = c.results!;
  const rows: [string, number | null][] = [
    [t("metrics.sent"), r.sent],
    [t("metrics.delivered"), r.delivered],
    [c.channel === "email" ? t("metrics.opened") : t("metrics.read"), r.read],
    ...(r.clicked !== undefined ? ([[t("metrics.clicked"), r.clicked]] as [string, number][]) : []),
    [t("metrics.replied"), r.replied],
    [t("metrics.orders"), r.orders],
  ];
  return (
    <ul className="grid gap-2.5">
      {rows.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-sm">
          <span>{label}</span>
          <span className="h-2 rounded-full bg-surface-2">{n !== null && <span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.max(1, (n / r.sent) * 100)}%` }} />}</span>
          <span className="text-end tabular-nums text-muted">{n === null ? t("noReceipts") : `${fmt.number(n)} · ${Math.round((n / r.sent) * 100)}%`}</span>
        </li>
      ))}
    </ul>
  );
}

export function CampaignDetail({ base, c, canApprove }: { base: string; c: Campaign; canApprove: boolean }) {
  const t = useT("campaignsPage");
  const tAll = useT();
  const fmt = useFormat();
  const [status, setStatus] = useState(c.status);
  const seg = SEGMENTS.find((s) => s.id === c.segment)!;
  const a = audience(seg, c.channel);
  const card = "grid gap-3 rounded-[var(--radius-panel)] border border-border bg-surface p-5";
  return (
    <div className="grid gap-5">
      <Link href={`${base}/campaigns`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />{t("title")}</Link>
      <header className="flex flex-wrap items-center gap-3">
        <ChannelMark ch={c.channel} size={40} label={tAll(`channels.${c.channel}`)} />
        <div className="grid flex-1 gap-0.5">
          <h1 className="title text-2xl">{c.name}</h1>
          <p className="text-sm text-muted">{seg.name} · {t("by", { name: c.createdBy })}{c.approvedBy ? ` · ${t("approvedBy", { name: c.approvedBy })}` : ""}</p>
        </div>
        <Badge tone={TONE[status]}>{t(`status.${status}`)}</Badge>
      </header>

      {status === "approval" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-warn/40 bg-warn-soft p-4 text-sm">
          <p>{t("approvalNeeded", { count: fmt.number(a.eligible), over: fmt.number(APPROVAL_OVER) })}</p>
          {canApprove ? (
            <span className="flex gap-2">
              <button type="button" onClick={() => setStatus("draft")} className={buttonClass("ghost", "sm")}>{t("sendBack")}</button>
              <button type="button" onClick={() => setStatus("scheduled")} className={buttonClass("primary", "sm")}>{t("approve")}</button>
            </span>
          ) : <span className="text-muted">{t("approvalOwner")}</span>}
        </div>
      )}
      {status === "scheduled" && c.status === "approval" && <p role="status" className="flex items-center gap-2 text-sm"><CheckCircle size={16} className="text-done" aria-hidden="true" />{t("approvedNote")}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-5">
          {c.results ? (
            <section className={card}><h2 className="font-semibold">{t("results")}</h2><Funnel c={c} /><p className="text-xs text-muted">{t("optedOut", { count: c.results.optedOut })}</p></section>
          ) : (
            <section className={card}><h2 className="font-semibold">{t("notSentYet")}</h2><p className="text-sm text-muted">{status === "scheduled" ? t("sendsIn", { count: c.when, time: c.localTime ?? "" }) : t("draftNote")}</p></section>
          )}
          {c.ab && (
            <section className={card}>
              <h2 className="font-semibold">{t("abTitle")}</h2>
              {(["a", "b"] as const).map((v) => (
                <p key={v} className={`flex items-center justify-between gap-3 rounded-[var(--radius-control)] border px-3 py-2 text-sm ${c.ab!.winner === v ? "border-primary bg-primary-soft" : "border-border"}`}>
                  <span className="flex items-center gap-2"><span className="font-medium">{v.toUpperCase()}</span> &ldquo;{c.ab![v]}&rdquo;</span>
                  <span className="flex items-center gap-1.5 tabular-nums">{c.ab!.winner === v && <Trophy size={14} className="text-primary" aria-label={t("winner")} />}{c.ab![v === "a" ? "aPct" : "bPct"]}% {t(`metrics.${c.ab!.metric}`).toLowerCase()}</span>
                </p>
              ))}
              <p className="text-xs text-muted">{t("abNote")}</p>
            </section>
          )}
          {c.id === "c2" && (
            <section className={card}>
              <h2 className="font-semibold">{t("replies")}</h2>
              <p className="text-sm text-muted">{t("repliesNote")}</p>
              <Link href={`${base}/inbox?c=ana`} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm hover:bg-surface-2"><span><span className="font-medium">Ana Costa</span> · &ldquo;Yes please! Can you hold one in white?&rdquo;</span><span className="text-xs text-primary">{t("openChat")}</span></Link>
            </section>
          )}
        </div>
        <aside className="grid content-start gap-5">
          <section className={card}>
            <h2 className="font-semibold">{t("audience")}</h2>
            <dl className="grid gap-1.5 text-sm">
              <div className="flex justify-between"><dt>{t("inSegment")}</dt><dd className="tabular-nums">{fmt.number(a.total)}</dd></div>
              {(["noHandle", "noConsent", "dnc", "outsideWindow"] as const).filter((k) => a.excluded[k] > 0).map((k) => (
                <div key={k} className="flex justify-between text-muted"><dt>{t(`excluded.${k}`, { channel: tAll(`channels.${c.channel}`) })}</dt><dd className="tabular-nums">−{fmt.number(a.excluded[k])}</dd></div>
              ))}
              <div className="flex justify-between border-t border-border pt-1.5 font-medium"><dt>{t("willReceive")}</dt><dd className="tabular-nums">{fmt.number(a.eligible)}</dd></div>
            </dl>
          </section>
          <section className={card}>
            <h2 className="font-semibold">{t("message")}</h2>
            {c.message.subject && <p className="text-sm"><span className="text-muted">{t("subject")}:</span> {c.message.subject}</p>}
            {c.message.template && <p className="text-xs text-muted">{t("templateName", { name: c.message.template })}</p>}
            <p className="whitespace-pre-line rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm">{c.message.body}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
