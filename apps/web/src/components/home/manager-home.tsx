import Link from "next/link";
import type { ReactNode } from "react";
import { CaretRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { SetupChip } from "./setup-chip";
import { canSeeDealValue, replyAccess, windowOpen, type RoleTemplateKey } from "@app/domain";
import type { InboxData } from "@/components/inbox/types";
import { getFormat, getT } from "@/i18n/server";
import { valueLabel } from "@/i18n/labels";
import type { en } from "@/i18n/messages/en";
import type { Format, TFor, Translator } from "@/i18n/types";

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

/* Sample numbers until reports exist. Values are typed so each language formats them its own way. */
type Value = { usd: number } | { min: number } | { n: number };
type Hint = { up: number } | { target: number };
type Stat = [keyof typeof en.home.stats, Value, Hint?];
const NUMBERS: Record<RoleTemplateKey, Stat[]> = {
  owner: [["revenue", { usd: 48_620 }, { up: 12 }], ["pipeline", { usd: 25_700 }], ["medianReply", { min: 6 }, { target: 30 }], ["unassigned", { n: 3 }]],
  sales_manager: [["pipeline", { usd: 25_700 }], ["won", { usd: 19_560 }, { up: 8 }], ["leads", { n: 31 }], ["followUpsToday", { n: 4 }]],
  support_manager: [["openChats", { n: 22 }], ["waitingCustomer", { n: 9 }], ["medianReply", { min: 6 }, { target: 30 }], ["overTarget", { n: 2 }]],
  ops_manager: [["tasksToday", { n: 9 }], ["ordersToFulfil", { n: 5 }], ["meetingsToday", { n: 2 }], ["overdueTasks", { n: 1 }]],
  agent: [["yourOpenChats", { n: 7 }], ["yourOpenDeals", { n: 3 }], ["yourFirstReply", { min: 4 }, { target: 30 }], ["followUpsToday", { n: 2 }]],
  viewer: [["openChats", { n: 22 }], ["medianReply", { min: 6 }], ["resolvedWeek", { n: 48 }], ["overTarget", { n: 2 }]],
};

function value(v: Value, fmt: Format, time: TFor<"time">) {
  return "usd" in v ? fmt.moneyWhole(v.usd) : "min" in v ? time("minutes", { count: v.min }) : fmt.number(v.n);
}
function hint(h: Hint, t: TFor<"home">, time: TFor<"time">) {
  return "up" in h ? t("upOnLastMonth", { pct: h.up }) : t("target", { time: time("minutes", { count: h.target }) });
}

const SHOWN = 5;

function greeting(now: number, t: TFor<"home">, name: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "numeric", hourCycle: "h23" }).format(now));
  return t(h < 12 ? "morning" : h < 17 ? "afternoon" : "evening", { name });
}

export function needsFor(data: InboxData, inboxHref: string, tAll: Translator, fmt: Format): NeedRow[] {
  const { viewer: v, now, people } = data;
  const t = (key: string, vars?: Record<string, string | number>) => tAll(`home.needs.${key}`, vars);
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? tAll("common.someone");
  const rows: NeedRow[] = [];

  // A broken channel stops every conversation on it, so the owner sees it first (decided 2026-10-07).
  if (v.scopes["numbers.manage"] === "all") {
    for (const inbox of data.inboxes.filter((i) => i.broken)) {
      rows.push({
        id: `inbox-${inbox.id}`,
        name: inbox.name,
        href: inboxHref,
        tone: "fail",
        rank: -1,
        waitingSince: null,
        meta: tAll(`channels.${inbox.channel}`),
        items: [tAll(`omni.broken.${inbox.broken!}`, { inbox: inbox.name }), tAll("omni.broken.reconnect")],
      });
    }
  }

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
        items.push({ text: t("unclaimed"), rank: over ? 0 : 2, tone: over ? "warn" : "plain" });
        waitingSince = c.lastCustomerAt;
      }
      if (mine && c.phoneReply) items.push({ text: t("phoneReply", { name: name(c.phoneReply.authorId) }), rank: 1, tone: "warn" });
      else if (mine && last?.kind === "in" && c.lastCustomerAt) {
        items.push({ text: t("yourReply"), rank: 2, tone: "plain" });
        waitingSince = c.lastCustomerAt;
      }
      if (mine && last?.status === "failed") items.push({ text: t("failed"), rank: 1, tone: "fail" });
      if (mine && c.channel === "whatsapp" && !windowOpen(c.lastCustomerAt, now) && last?.kind !== "in") {
        items.push({ text: t("windowClosed"), rank: 3, tone: "plain" });
      }
    }
    for (const task of c.contact.tasks) {
      if (task.ownerId === v.memberId && !task.done) items.push({ text: t("task", { text: task.text, when: valueLabel(tAll, "due", task.due) }), rank: 3, tone: "plain" });
    }
    for (const d of c.contact.deals) {
      if (d.ownerId === v.memberId && d.stage === "quoted") {
        items.push({ text: canSeeDealValue(v, d.ownerId) ? t("quoteValue", { value: fmt.money(d.fils) }) : t("quote"), rank: 3, tone: "plain" });
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
      meta: waitingSince ? t("waiting", { time: fmt.waitedFor(waitingSince, now) }) : null,
      items: items.map((i) => i.text),
    });
  }
  // Most urgent first; among equals, whoever has waited longest.
  return rows.sort((a, b) => a.rank - b.rank || (a.waitingSince ?? Infinity) - (b.waitingSince ?? Infinity));
}

function Row({ n, t }: { n: NeedRow; t: TFor<"home"> }) {
  return (
    <li className="border-b border-border last:border-0">
      <Link href={n.href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              {n.tone !== "plain" && <WarningCircle size={18} weight="fill" className={`shrink-0 ${n.tone === "fail" ? "text-fail" : "text-warn"}`} aria-label={n.tone === "fail" ? t("failedSr") : t("attentionSr")} />}
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
        <CaretRight size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
      </Link>
    </li>
  );
}

export async function ManagerHome({
  firstName,
  template,
  data,
  inboxHref,
  setup,
  extraNeeds,
  briefings,
}: {
  firstName: string;
  template: RoleTemplateKey;
  data: InboxData;
  inboxHref: string;
  /** Unfinished setup, shown as a small link until done (decided 2026-09-30). */
  setup?: { done: number; total: number; href: string };
  /** Rows from elsewhere, e.g. discount approvals waiting for this person. */
  extraNeeds?: NeedRow[];
  /** "From your agents": AI work waiting for this person's approval. */
  briefings?: ReactNode;
}) {
  const tAll = await getT();
  const t = await getT("home");
  const time = await getT("time");
  const fmt = await getFormat();
  const needs = [...(extraNeeds ?? []), ...needsFor(data, inboxHref, tAll, fmt)].sort((a, b) => a.rank - b.rank || (a.waitingSince ?? Infinity) - (b.waitingSince ?? Infinity));
  const date = fmt.longDate(data.now);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-sm text-muted">{date}</p>
          <h1 className="display text-4xl sm:text-5xl">{greeting(data.now, t, firstName)}</h1>
        </div>
        {setup && <SetupChip {...setup} />}
      </header>

      <section aria-labelledby="needs" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="needs" className="text-lg font-semibold">{t("needsNow")}</h2>
          <span className="text-sm text-muted">{needs.length === 0 ? t("allClear") : t("customers", { count: needs.filter((n) => !n.id.startsWith("inbox-")).length })}</span>
        </div>
        {needs.length === 0 ? (
          <p className="rounded-[var(--radius-panel)] bg-surface p-6 text-muted shadow-[var(--shadow-1)]">{t("nothing")}</p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">
            <ul>{needs.slice(0, SHOWN).map((n) => <Row key={n.id} n={n} t={t} />)}</ul>
            {needs.length > SHOWN && (
              <details className="group border-t border-border">
                <summary className="flex min-h-11 cursor-pointer list-none items-center px-5 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden group-open:hidden">
                  {t("seeAll", { count: needs.length })}
                </summary>
                <ul>{needs.slice(SHOWN).map((n) => <Row key={n.id} n={n} t={t} />)}</ul>
              </details>
            )}
          </div>
        )}
      </section>

      {/* Agents come after people waiting (decided 2026-10-01). */}
      {briefings}

      <section aria-labelledby="numbers" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="numbers" className="text-lg font-semibold">{t("thisMonth")}</h2>
          <span className="text-sm text-muted">{t("sampleNumbers")}</span>
        </div>
        <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border lg:grid-cols-4">
          {NUMBERS[template].map(([label, v, h], i) => (
            <div key={label} className={`grid content-start gap-1 p-5 ${i % 2 ? "border-s border-border" : ""} ${i >= 2 ? "border-t border-border lg:border-t-0" : ""} ${i === 2 ? "lg:border-s" : ""}`}>
              <dt className="text-sm text-muted">{t(`stats.${label}`)}</dt>
              <dd className="display whitespace-nowrap text-2xl sm:text-3xl">{value(v, fmt, time)}</dd>
              {h && <dd className="text-xs text-muted">{hint(h, t, time)}</dd>}
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
