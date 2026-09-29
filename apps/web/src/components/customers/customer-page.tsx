"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import {
  ArrowLeft,
  ArrowsLeftRight,
  ChatCircle,
  CheckSquare,
  DotsThree,
  EnvelopeSimple,
  Handshake,
  NotePencil,
  ShoppingBag,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { canSeeDealValue, type Viewer } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { aed, dayLabel, dueText, sameDay, time } from "@/components/inbox/format";
import type { Person, Team } from "@/components/inbox/types";
import type { Customer, TimelineKind } from "./types";

const STAGE = { new: ["New", "new"], quoted: ["Quoted", "transit"], won: ["Won", "done"], lost: ["Lost", "fail"] } as const;
const KIND: Record<TimelineKind, { Icon: Icon; group: Filter }> = {
  chat: { Icon: ChatCircle, group: "chats" },
  email: { Icon: EnvelopeSimple, group: "email" },
  note: { Icon: NotePencil, group: "notes" },
  handoff: { Icon: ArrowsLeftRight, group: "chats" },
  deal: { Icon: Handshake, group: "deals" },
  order: { Icon: ShoppingBag, group: "orders" },
  task: { Icon: CheckSquare, group: "deals" },
};
type Filter = "all" | "chats" | "email" | "deals" | "orders" | "notes";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["chats", "Chats"],
  ["email", "Email"],
  ["deals", "Deals and follow-ups"],
  ["orders", "Orders"],
  ["notes", "Notes"],
];

interface Props {
  c: Customer;
  duplicate: Customer | null;
  people: Person[];
  teams: Team[];
  viewer: Viewer;
  now: number;
  base: string;
  canMerge: boolean;
  canErase: boolean;
}

/* The customer page: who they are on the side, everything that happened in one timeline (decided 2026-09-30). */
export function CustomerPage({ c, duplicate, people, teams, viewer, now, base, canMerge, canErase }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [erasing, setErasing] = useState(false);
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? "Nobody";
  const items = c.timeline.filter((t) => filter === "all" || KIND[t.kind].group === filter);
  const present = new Set(c.timeline.map((t) => KIND[t.kind].group));
  const ordersTotal = c.orders.reduce((s, o) => s + o.fils, 0);

  const rows: [string, React.ReactNode][] = [
    ...(c.phone ? [["Phone", <span key="p" dir="ltr" className="tabular-nums">{c.phone}</span>] as [string, React.ReactNode]] : []),
    ...(c.email ? [["Email", <span key="e" className="break-all">{c.email}</span>] as [string, React.ReactNode]] : []),
    ["Language", c.language],
    ...(c.area ? [["Area", c.area] as [string, React.ReactNode]] : []),
    ["Type", c.type],
    ["Source", c.source],
    ["Team", teams.find((t) => t.id === c.teamId)?.name ?? "None"],
    ["Owner", name(c.ownerId)],
  ];

  return (
    <div className="grid gap-6">
      <Link href={`${base}/customers`} className="-mb-2 inline-flex min-h-9 w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> Customers
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="title text-3xl sm:text-4xl"><bdi>{c.name}</bdi></h1>
          <p className="text-muted">{[c.company, c.type, c.area].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex items-center gap-2">
          {c.conversationId && <Link href={`${base}/inbox?c=${c.conversationId}`} className={buttonClass("primary", "sm")}>Open chat</Link>}
          <button type="button" disabled className={buttonClass("secondary", "sm")} title="Deals arrive with the Deals milestone">New deal</button>
          {(canMerge || canErase) && (
            <details className="relative">
              <summary className={buttonClass("ghost", "sm", "!px-2 list-none [&::-webkit-details-marker]:hidden")} aria-label="More actions">
                <DotsThree size={22} weight="bold" aria-hidden="true" />
              </summary>
              <div className="absolute end-0 top-full z-20 mt-1 grid min-w-56 rounded-[var(--radius-control)] border border-border bg-surface p-1 shadow-[var(--shadow-2)]">
                {canMerge && duplicate && (
                  <Link href={`${base}/customers/merge?a=${c.id}&b=${duplicate.id}`} className="flex min-h-11 items-center rounded px-3 hover:bg-surface-2">Merge with {duplicate.name}…</Link>
                )}
                {canErase && (
                  <button type="button" onClick={() => setErasing(true)} className="min-h-11 rounded px-3 text-start text-fail hover:bg-surface-2">Erase this customer…</button>
                )}
              </div>
            </details>
          )}
        </div>
      </header>

      {erasing && (
        <div role="alert" className="grid gap-3 rounded-[var(--radius-panel)] bg-fail-soft p-4">
          <p className="text-sm">
            <strong className="font-semibold">Erase {c.name}?</strong> This deletes their messages, media, notes and deals for good (UAE PDPL). The audit log records that an erasure happened, without the data. Meta keeps its own copy of WhatsApp messages, which we can&apos;t delete.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setErasing(false)} className={buttonClass("ghost", "sm")}>Cancel</button>
            <button type="button" disabled className={buttonClass("destructive", "sm")} title="Turned off in the preview">Erase {c.name.split(" ")[0]}</button>
          </div>
        </div>
      )}

      {duplicate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-warn-soft px-4 py-3 text-sm">
          <p className="flex gap-2">
            <WarningCircle size={20} className="shrink-0 text-warn" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Possible duplicate.</strong> <Link href={`${base}/customers/${duplicate.id}`} className="underline underline-offset-2">{duplicate.name}</Link> has the same {duplicate.email && duplicate.email === c.email ? "email" : "company"}. Merging joins their timelines.
            </span>
          </p>
          {canMerge && <Link href={`${base}/customers/merge?a=${c.id}&b=${duplicate.id}`} className={buttonClass("secondary", "sm")}>Compare and merge</Link>}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Who they are */}
        <aside aria-label="Customer details" className="grid gap-5 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border lg:sticky lg:top-6">
          <dl className="grid gap-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted">{k}</dt>
                <dd className="min-w-0 text-end">{v}</dd>
              </div>
            ))}
          </dl>
          {c.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
              {c.tags.map((t) => <li key={t} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{t}</li>)}
            </ul>
          )}
          {c.deals.length > 0 && (
            <section className="grid gap-2 border-t border-border pt-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Deals</h2>
              {c.deals.map((d) => (
                <div key={d.id} className="grid gap-0.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{d.title}</span>
                    <Badge tone={STAGE[d.stage][1]}>{STAGE[d.stage][0]}</Badge>
                  </div>
                  <span className="text-muted">{canSeeDealValue(viewer, d.ownerId) ? <span className="tabular-nums text-text">{aed(d.fils)}</span> : "Value hidden for your role"} · {name(d.ownerId)}</span>
                </div>
              ))}
            </section>
          )}
          {c.tasks.length > 0 && (
            <section className="grid gap-2 border-t border-border pt-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Follow-ups</h2>
              {c.tasks.map((t) => (
                <p key={t.id} className="text-sm">{t.text}<span className="block text-muted">{name(t.ownerId)} · {dueText(t.due)}</span></p>
              ))}
            </section>
          )}
          {c.orders.length > 0 && (
            <section className="grid gap-1 border-t border-border pt-4 text-sm">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Orders</h2>
              <p><span className="tabular-nums">{aed(ordersTotal)}</span> <span className="text-muted">across {c.orders.length} {c.orders.length === 1 ? "order" : "orders"}</span></p>
            </section>
          )}
        </aside>

        {/* Everything that happened */}
        <section aria-label="Timeline" className="grid gap-4">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
            {FILTERS.filter(([f]) => f === "all" || present.has(f)).map(([f, label]) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-9 rounded-full px-3.5 text-sm transition-colors ${filter === f ? "bg-primary-soft font-semibold text-primary" : "text-muted hover:bg-surface-2 hover:text-text"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <p className="rounded-[var(--radius-panel)] bg-surface p-6 text-muted shadow-[var(--shadow-1)] ring-1 ring-border">Nothing here yet.</p>
          ) : (
            <ol className="grid">
              {items.map((t, i) => {
                const { Icon } = KIND[t.kind];
                const newDay = i === 0 || !sameDay(items[i - 1].at, t.at);
                const body = (
                  <>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-muted shadow-[var(--shadow-1)] ring-1 ring-border"><Icon size={18} aria-hidden="true" /></span>
                    <span className="grid min-w-0 flex-1 gap-0.5 pt-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{t.title}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{time(t.at)}</span>
                      </span>
                      {t.body && <span className={`text-sm text-muted ${t.kind === "note" ? "rounded-[var(--radius-control)] border border-dashed border-note-border bg-note-soft px-3 py-2 text-text" : "line-clamp-2"}`} dir="auto">{t.kind === "deal" ? `Stage: ${t.body.charAt(0).toUpperCase()}${t.body.slice(1)}` : t.body}</span>}
                      {t.by && <span className="text-xs text-muted">{t.by}</span>}
                    </span>
                  </>
                );
                return (
                  <Fragment key={t.id}>
                    {newDay && <li className="pb-2 pt-4 text-xs font-medium uppercase tracking-wide text-muted first:pt-0">{dayLabel(t.at, now)}</li>}
                    <li className="relative ps-0">
                      {t.href ? (
                        <Link href={`${base}/${t.href}`} className="flex gap-3 rounded-[var(--radius-control)] p-2 transition-colors hover:bg-surface">{body}</Link>
                      ) : (
                        <div className="flex gap-3 p-2">{body}</div>
                      )}
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
