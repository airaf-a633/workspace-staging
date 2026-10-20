"use client";

import Link from "next/link";
import { ArrowLeft, Buildings } from "@phosphor-icons/react";
import { canSeeDealValue, type Viewer } from "@app/domain";
import { ChannelMark } from "@/components/channels/channel-mark";
import { Badge } from "@/components/ui/surface";
import { STAGE } from "@/components/deals/stages";
import type { Person } from "@/components/inbox/types";
import { useFormat, useT } from "@/i18n/client";
import { lineText } from "@/i18n/labels";
import type { Company, Customer } from "./types";

/* A company (decided 2026-10-07): its people, and every conversation, deal and order across all of them. */
export function CompanyPage({ co, people: staff, viewer, now, base }: { co: Company & { people: Customer[] }; people: Person[]; viewer: Viewer; now: number; base: string }) {
  const t = useT("company");
  const tc = useT("customers");
  const tAll = useT();
  const fmt = useFormat();
  const name = (id: string | null) => staff.find((p) => p.id === id)?.name ?? tAll("common.nobody");
  const deals = co.people.flatMap((p) => p.deals.map((d) => ({ ...d, person: p.name })));
  const orders = co.people.flatMap((p) => p.orders);
  const total = orders.reduce((s, o) => s + o.fils, 0);
  const conversations = co.people
    .flatMap((p) => p.timeline.filter((x) => x.kind === "chat" || x.kind === "email").map((x) => ({ ...x, person: p.name })))
    .sort((a, b) => b.at - a.at)
    .slice(0, 12);

  const stats: [string, string][] = [
    [t("people"), String(co.people.length)],
    [t("openDeals"), String(deals.filter((d) => d.stage !== "won" && d.stage !== "lost").length)],
    [t("orders"), orders.length ? fmt.money(total) : "—"],
  ];

  return (
    <div className="grid gap-6">
      <Link href={`${base}/customers`} className="-mb-2 inline-flex min-h-9 w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <header className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-[var(--radius-panel)] bg-surface-2 text-muted" aria-hidden="true"><Buildings size={28} /></span>
        <div className="grid gap-1">
          <h1 className="title text-3xl"><bdi>{co.name}</bdi></h1>
          <p className="text-muted">{[co.domain, co.industry, co.size && t("size", { size: co.size }), co.location].filter(Boolean).join(" · ")}</p>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-panel)] bg-border ring-1 ring-border">
        {stats.map(([k, v]) => (
          <div key={k} className="grid gap-1 bg-surface px-5 py-4">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="text-xl font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="grid gap-3" aria-labelledby="co-convs">
          <h2 id="co-convs" className="text-lg font-semibold">{t("conversations")}</h2>
          {conversations.length === 0 ? (
            <p className="rounded-[var(--radius-panel)] bg-surface p-6 text-muted ring-1 ring-border">{t("noConversations")}</p>
          ) : (
            <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface ring-1 ring-border">
              {conversations.map((x) => (
                <li key={x.id} className="border-b border-border last:border-0">
                  <Link href={x.href ? `${base}/${x.href}` : `${base}/customers`} className="grid gap-0.5 px-5 py-3 hover:bg-surface-2">
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium"><bdi>{x.person}</bdi> · <span className="font-normal text-muted">{lineText(tAll, x.title)}</span></span>
                      <span className="shrink-0 text-xs text-muted">{fmt.ago(x.at, now)}</span>
                    </span>
                    {x.body && <span className="line-clamp-1 text-sm text-muted" dir="auto">{x.body}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="grid gap-5 rounded-[var(--radius-panel)] bg-surface p-5 ring-1 ring-border">
          <section className="grid gap-2">
            <h2 className="text-xs font-medium text-muted">{t("peopleTitle")}</h2>
            <ul className="grid gap-2.5">
              {co.people.map((p) => (
                <li key={p.id}>
                  <Link href={`${base}/customers/${p.id}`} className="flex items-center gap-2.5 text-sm hover:underline">
                    <span className="flex -space-x-1 rtl:space-x-reverse">{p.identities.slice(0, 2).map((i) => <ChannelMark key={i.ch + i.handle} ch={i.ch} size={18} label={false} className="ring-2 ring-surface" />)}</span>
                    <bdi className="min-w-0 flex-1 truncate">{p.name}</bdi>
                    <span className="text-xs text-muted">{tc(`lifecycle.${p.lifecycle}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          {deals.length > 0 && (
            <section className="grid gap-2 border-t border-border pt-4">
              <h2 className="text-xs font-medium text-muted">{t("deals")}</h2>
              {deals.map((d) => (
                <div key={d.id} className="grid gap-0.5 text-sm">
                  <span className="flex items-start justify-between gap-2"><bdi className="font-medium">{d.title}</bdi><Badge tone={STAGE[d.stage][1]}>{tAll(`stages.${d.stage}`)}</Badge></span>
                  <span className="text-muted">{canSeeDealValue(viewer, d.ownerId) ? fmt.money(d.fils) : tAll("panel.valueHidden")} · <bdi>{d.person}</bdi></span>
                </div>
              ))}
            </section>
          )}
          <dl className="grid gap-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">{t("owner")}</dt><dd>{name(co.ownerId)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">{t("since")}</dt><dd>{fmt.shortDate(co.createdAt)}</dd></div>
          </dl>
          {co.tags.length > 0 && <ul className="flex flex-wrap gap-1.5">{co.tags.map((x) => <li key={x} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{x}</li>)}</ul>}
        </aside>
      </div>
    </div>
  );
}
