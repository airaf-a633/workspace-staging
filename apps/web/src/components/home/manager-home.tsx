import Link from "next/link";
import { CaretRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { SetupChip } from "./setup-chip";
import { canSeeDealValue, replyAccess, windowOpen, type RoleTemplateKey } from "@app/domain";
import { aed, dueText, waitedFor } from "@/components/inbox/format";
import type { InboxData } from "@/components/inbox/types";

/*
 * A manager's home after setup: "Needs you now" first, then the four numbers for their role.
 * One row per customer (decided 2026-09-30), built from the same conversations and access rules as the inbox.
 */

type Tone = "fail" | "warn" | "plain";
export interface NeedRow {
  id: string;
  name: string;
  href: string;
  tone: Tone;
  rank: number;
  /** When the customer started waiting, for sorting and the "waiting" label. */
  waitingSince: number | null;
  meta: string | null;
  items: string[];
}

const NUMBERS: Record<RoleTemplateKey, [string, string, string?][]> = {
  owner: [["Revenue this month", "AED 186,420", "+12% on August"], ["Open pipeline", "AED 94,300"], ["Median first reply", "6 min", "Target 30 min"], ["Unassigned chats", "3"]],
  sales_manager: [["Open pipeline", "AED 94,300"], ["Won this month", "AED 71,850", "+8% on August"], ["Leads from WhatsApp", "31"], ["Follow-ups today", "4"]],
  support_manager: [["Open chats", "22"], ["Waiting on customer", "9"], ["Median first reply", "6 min", "Target 30 min"], ["Over reply target", "2"]],
  ops_manager: [["Tasks due today", "9"], ["Orders to fulfil", "5"], ["Meetings today", "2"], ["Overdue tasks", "1"]],
  agent: [["Your open chats", "7"], ["Your open deals", "3"], ["Your first reply", "4 min", "Target 30 min"], ["Follow-ups today", "2"]],
  viewer: [["Open chats", "22"], ["Median first reply", "6 min"], ["Resolved this week", "48"], ["Over reply target", "2"]],
};

const SHOWN = 5;

function greeting(now: number) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "numeric", hourCycle: "h23" }).format(now));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function needsFor(data: InboxData, inboxHref: string): NeedRow[] {
  const { viewer: v, now, people } = data;
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? "Someone";
  const rows: NeedRow[] = [];

  for (const c of data.conversations) {
    const access = replyAccess(v, c);
    if (access === "hidden" || c.status === "spam") continue;
    const real = c.messages.filter((m) => m.kind !== "event");
    const last = real[real.length - 1];
    const mine = c.holderId === v.memberId;
    const items: { text: string; rank: number; tone: Tone }[] = [];
    let waitingSince: number | null = null;

    if (c.status === "open") {
      if (!c.holderId && access === "claim" && last?.kind === "in" && c.lastCustomerAt) {
        const over = now - c.lastCustomerAt > 30 * 60_000;
        items.push({ text: "Nobody has claimed the chat", rank: over ? 0 : 2, tone: over ? "warn" : "plain" });
        waitingSince = c.lastCustomerAt;
      }
      if (mine && c.phoneReply) items.push({ text: `${name(c.phoneReply.authorId)} replied from the phone: check before sending`, rank: 1, tone: "warn" });
      else if (mine && last?.kind === "in" && c.lastCustomerAt) {
        items.push({ text: "Waiting for your reply", rank: 2, tone: "plain" });
        waitingSince = c.lastCustomerAt;
      }
      if (mine && last?.status === "failed") items.push({ text: "Your message wasn't delivered", rank: 1, tone: "fail" });
      if (mine && c.channel === "whatsapp" && !windowOpen(c.lastCustomerAt, now) && last?.kind !== "in") {
        items.push({ text: "24h window closed: send a template", rank: 3, tone: "plain" });
      }
    }
    for (const t of c.contact.tasks) {
      if (t.ownerId === v.memberId && !t.done) items.push({ text: `${t.text}, ${dueText(t.due)}`, rank: 3, tone: "plain" });
    }
    for (const d of c.contact.deals) {
      if (d.ownerId === v.memberId && d.stage === "quoted") {
        items.push({ text: `Quote to follow up${canSeeDealValue(v, d.ownerId) ? ` · ${aed(d.fils)}` : ""}`, rank: 3, tone: "plain" });
      }
    }
    if (items.length === 0) continue;

    items.sort((a, b) => a.rank - b.rank);
    const tone: Tone = items.some((i) => i.tone === "fail") ? "fail" : items.some((i) => i.tone === "warn") ? "warn" : "plain";
    rows.push({
      id: c.id,
      name: c.contact.name,
      href: `${inboxHref}?c=${c.id}`,
      tone,
      rank: items[0].rank,
      waitingSince,
      meta: waitingSince ? `Waiting ${waitedFor(waitingSince, now)}` : null,
      items: items.map((i) => i.text),
    });
  }
  // Most urgent first; among equals, whoever has waited longest.
  return rows.sort((a, b) => a.rank - b.rank || (a.waitingSince ?? Infinity) - (b.waitingSince ?? Infinity));
}

function Row({ n }: { n: NeedRow }) {
  return (
    <li className="border-b border-border last:border-0">
      <Link href={n.href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              {n.tone !== "plain" && <WarningCircle size={18} weight="fill" className={`shrink-0 ${n.tone === "fail" ? "text-fail" : "text-warn"}`} aria-label={n.tone === "fail" ? "Failed" : "Needs attention"} />}
              <bdi className="truncate">{n.name}</bdi>
            </span>
            {n.meta && <span className={`shrink-0 text-sm tabular-nums ${n.tone === "warn" ? "font-medium text-warn" : "text-muted"}`}>{n.meta}</span>}
          </span>
          <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-muted">
            {n.items.map((t, i) => (
              <span key={i}>{i > 0 && <span aria-hidden="true" className="me-2">·</span>}{t}</span>
            ))}
          </span>
        </span>
        <CaretRight size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function ManagerHome({
  firstName,
  template,
  data,
  inboxHref,
  setup,
}: {
  firstName: string;
  template: RoleTemplateKey;
  data: InboxData;
  inboxHref: string;
  /** Unfinished setup, shown as a small link until done (decided 2026-09-30). */
  setup?: { done: number; total: number; href: string };
}) {
  const needs = needsFor(data, inboxHref);
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "long", day: "numeric", month: "long" }).format(data.now);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-sm text-muted">{date}</p>
          <h1 className="display text-4xl sm:text-5xl">{greeting(data.now)}, {firstName}</h1>
        </div>
        {setup && <SetupChip {...setup} />}
      </header>

      <section aria-labelledby="needs" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="needs" className="text-lg font-semibold">Needs you now</h2>
          <span className="text-sm text-muted">{needs.length === 0 ? "All clear" : `${needs.length} ${needs.length === 1 ? "customer" : "customers"}`}</span>
        </div>
        {needs.length === 0 ? (
          <p className="rounded-[var(--radius-panel)] bg-surface p-6 text-muted shadow-[var(--shadow-1)]">Nothing needs you right now. New chats and follow-ups show up here.</p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">
            <ul>{needs.slice(0, SHOWN).map((n) => <Row key={n.id} n={n} />)}</ul>
            {needs.length > SHOWN && (
              <details className="group border-t border-border">
                <summary className="flex min-h-11 cursor-pointer list-none items-center px-5 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden group-open:hidden">
                  See all {needs.length}
                </summary>
                <ul>{needs.slice(SHOWN).map((n) => <Row key={n.id} n={n} />)}</ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="numbers" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="numbers" className="text-lg font-semibold">This month</h2>
          <span className="text-sm text-muted">Sample numbers</span>
        </div>
        <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border lg:grid-cols-4">
          {NUMBERS[template].map(([label, value, hint], i) => (
            <div key={label} className={`grid content-start gap-1 p-5 ${i % 2 ? "border-s border-border" : ""} ${i >= 2 ? "border-t border-border lg:border-t-0" : ""} ${i === 2 ? "lg:border-s" : ""}`}>
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="display whitespace-nowrap text-2xl sm:text-3xl">{value}</dd>
              {hint && <dd className="text-xs text-muted">{hint}</dd>}
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
