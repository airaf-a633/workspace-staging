import Link from "next/link";
import { CaretRight, ChatCircleDots, CheckSquare, DeviceMobile, Handshake, Hourglass, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { canSeeDealValue, replyAccess, windowOpen, type RoleTemplateKey } from "@app/domain";
import { aed, waitedFor } from "@/components/inbox/format";
import type { InboxData } from "@/components/inbox/types";

/*
 * A manager's home after setup: "Needs you now" first, then the four numbers for their role
 * (decided 2026-09-29). The list is derived from the same conversations and access rules as the inbox.
 */

type Need = { Icon: Icon; tone: "warn" | "fail" | "primary"; text: string; meta: string; href: string; rank: number };

const NUMBERS: Record<RoleTemplateKey, [string, string, string?][]> = {
  owner: [["Revenue this month", "AED 186,420", "+12% on August"], ["Open pipeline", "AED 94,300"], ["Median first reply", "6 min", "Target 30 min"], ["Unassigned chats", "3"]],
  sales_manager: [["Open pipeline", "AED 94,300"], ["Won this month", "AED 71,850", "+8% on August"], ["Leads from WhatsApp", "31"], ["Follow-ups today", "4"]],
  support_manager: [["Open chats", "22"], ["Waiting on customer", "9"], ["Median first reply", "6 min", "Target 30 min"], ["Over reply target", "2"]],
  ops_manager: [["Tasks due today", "9"], ["Orders to fulfil", "5"], ["Meetings today", "2"], ["Overdue tasks", "1"]],
  agent: [["Your open chats", "7"], ["Your open deals", "3"], ["Your first reply", "4 min", "Target 30 min"], ["Follow-ups today", "2"]],
  viewer: [["Open chats", "22"], ["Median first reply", "6 min"], ["Resolved this week", "48"], ["Over reply target", "2"]],
};

const TONE = { warn: "bg-warn-soft text-warn", fail: "bg-fail-soft text-fail", primary: "bg-primary-soft text-primary" };

function greeting(now: number) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "numeric", hourCycle: "h23" }).format(now));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function needsFor(data: InboxData, inboxHref: string): Need[] {
  const { viewer: v, now, people } = data;
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? "Someone";
  const needs: Need[] = [];

  for (const c of data.conversations) {
    if (c.status !== "open") continue;
    const access = replyAccess(v, c);
    if (access === "hidden") continue;
    const who = c.contact.name.split(" ")[0];
    const href = `${inboxHref}?c=${c.id}`;
    const real = c.messages.filter((m) => m.kind !== "event");
    const last = real[real.length - 1];
    const mine = c.holderId === v.memberId;

    if (!c.holderId && access === "claim" && last?.kind === "in" && c.lastCustomerAt) {
      const over = now - c.lastCustomerAt > 30 * 60_000;
      needs.push({ Icon: Hourglass, tone: over ? "warn" : "primary", text: `${c.contact.name} is waiting, and nobody has claimed the chat`, meta: `Waiting ${waitedFor(c.lastCustomerAt, now)}${over ? " · over reply target" : ""}`, href, rank: over ? 0 : 2 });
    }
    if (!mine) continue;
    if (c.phoneReply) {
      needs.push({ Icon: DeviceMobile, tone: "warn", text: `${name(c.phoneReply.authorId)} replied to ${who} from the phone while your reply was waiting`, meta: "Check before sending, so there are no two answers", href, rank: 1 });
    } else if (last?.kind === "in" && c.lastCustomerAt) {
      needs.push({ Icon: ChatCircleDots, tone: "primary", text: `${c.contact.name} is waiting for your reply`, meta: `Waiting ${waitedFor(c.lastCustomerAt, now)}`, href, rank: 2 });
    }
    if (last?.status === "failed") {
      needs.push({ Icon: WarningCircle, tone: "fail", text: `Your message to ${who} wasn't delivered`, meta: "Try calling, or email if you have an address", href, rank: 1 });
    }
    if (c.channel === "whatsapp" && !windowOpen(c.lastCustomerAt, now) && last?.kind !== "in") {
      needs.push({ Icon: Hourglass, tone: "primary", text: `${who}'s 24-hour window has closed`, meta: "Send a template to follow up", href, rank: 3 });
    }
  }

  for (const c of data.conversations) {
    if (replyAccess(v, c) === "hidden") continue;
    for (const t of c.contact.tasks) {
      if (t.ownerId === v.memberId && !t.done) needs.push({ Icon: CheckSquare, tone: "primary", text: t.text, meta: `${c.contact.name} · ${t.due}`, href: `${inboxHref}?c=${c.id}`, rank: 3 });
    }
    for (const d of c.contact.deals) {
      if (d.ownerId === v.memberId && d.stage === "quoted") {
        needs.push({ Icon: Handshake, tone: "primary", text: `Follow up on the quote for ${c.contact.name.split(" ")[0]}`, meta: `${d.title}${canSeeDealValue(v, d.ownerId) ? ` · ${aed(d.fils)}` : ""}`, href: `${inboxHref}?c=${c.id}`, rank: 3 });
      }
    }
  }
  return needs.sort((a, b) => a.rank - b.rank);
}

export function ManagerHome({ firstName, template, data, inboxHref }: { firstName: string; template: RoleTemplateKey; data: InboxData; inboxHref: string }) {
  const needs = needsFor(data, inboxHref);
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "long", day: "numeric", month: "long" }).format(data.now);

  return (
    <>
      <header className="grid gap-2">
        <p className="text-muted">{date}</p>
        <h1 className="display text-5xl sm:text-6xl">{greeting(data.now)}, {firstName}</h1>
      </header>

      <section aria-labelledby="needs" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="needs" className="text-lg font-semibold">Needs you now</h2>
          <span className="text-sm text-muted">{needs.length === 0 ? "All clear" : `${needs.length} ${needs.length === 1 ? "thing" : "things"}`}</span>
        </div>
        {needs.length === 0 ? (
          <p className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 text-muted">Nothing needs you right now. New chats and follow-ups will show up here.</p>
        ) : (
          <ul className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[var(--shadow-1)]">
            {needs.slice(0, 6).map((n, i) => (
              <li key={i} className="border-b border-border last:border-0">
                <Link href={n.href} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full ${TONE[n.tone]}`}><n.Icon size={20} aria-hidden="true" /></span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="font-medium">{n.text}</span>
                    <span className="text-sm text-muted">{n.meta}</span>
                  </span>
                  <CaretRight size={18} className="shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Your numbers" className="grid gap-3">
        <h2 className="text-lg font-semibold">This month</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {NUMBERS[template].map(([label, value, hint]) => (
            <div key={label} className="grid content-start gap-1 rounded-[var(--radius-panel)] border border-border bg-surface p-5">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="display text-3xl sm:text-4xl">{value}</dd>
              {hint && <dd className="text-sm text-muted">{hint}</dd>}
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted">Sample numbers. Real ones come from your chats, deals and orders once you&apos;re connected.</p>
      </section>
    </>
  );
}
