import type { BoardDeal } from "@/components/deals/sample";
import type { BoardTask } from "@/components/tasks/sample";
import { dayDiff } from "../i18n/zone";

/**
 * Deals and tasks from the database (decided 2026-11-03), in the same shapes the preview boards use, so the screens are the same.
 * Pure functions: the loaders in deals-live.ts and tasks-live.ts fetch, these only map.
 */

type One<T> = T | T[] | null | undefined;
const one = <T>(v: One<T>): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

export interface DealRow {
  id: string;
  title: string;
  status: "open" | "won" | "lost";
  contact_id: string | null;
  owner_member_id: string | null;
  team_id: string | null;
  expected_close: string | null;
  lost_reason: string | null;
  closed_at: string | null;
  created_at: string;
  pipeline_stages: One<{ key: string }>;
  /** Missing for a role that may not see money. */
  deal_values: One<{ value_minor: number | string }>;
  contacts: One<{ name: string | null; profile_name: string | null; email: string | null; phone: string | null }>;
  deal_notes: { author_member_id: string | null; body: string; created_at: string }[] | null;
  deal_approvals: {
    id: string;
    requested_by: string | null;
    percent: number | string;
    note: string | null;
    status: "pending" | "approved" | "declined";
    decided_by: string | null;
    created_at: string;
  }[] | null;
}

export interface TaskRow {
  id: string;
  text: string;
  owner_member_id: string | null;
  team_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  due_at: string | null;
  has_time: boolean;
  repeat: "daily" | "weekly" | "monthly" | null;
  done_at: string | null;
  contacts: One<{ name: string | null; profile_name: string | null; email: string | null; phone: string | null }>;
  task_notes: { author_member_id: string | null; body: string; created_at: string }[] | null;
}

const WEEKDAY = (tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long" });
const SHORT = (tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" });

/** A due moment as the word the screens already know: "Today", "Tomorrow", a weekday, a date, "Late" or "No date". */
export function dueWord(due: number | null, now: number, tz: string): string {
  if (due === null) return "No date";
  const d = dayDiff(due, now, tz);
  if (d < 0) return "Late";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 7) return WEEKDAY(tz).format(due);
  return SHORT(tz).format(due).replace("Sept", "Sep");
}

type ContactBits = { name: string | null; profile_name: string | null; email: string | null; phone: string | null };
const contactName = (c: ContactBits | undefined) => c?.name ?? c?.profile_name ?? c?.email ?? c?.phone ?? "No customer";

export function toBoardDeal(row: DealRow, extra: { followUp?: { text: string; due: string } | undefined; lastCustomerAt?: number | undefined } = {}): BoardDeal {
  const stageKey = one(row.pipeline_stages)?.key ?? "new";
  const stage = row.status === "open" ? (stageKey as BoardDeal["stage"]) : row.status;
  const value = one(row.deal_values)?.value_minor;
  const approvals = [...(row.deal_approvals ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latest = approvals[0];
  const created = Date.parse(row.created_at);
  return {
    id: row.id,
    title: row.title,
    // 0 when this role may not see money; the board hides it anyway (canSeeDealValue).
    fils: value === undefined ? 0 : Number(value),
    stage,
    ownerId: row.owner_member_id ?? "",
    customerId: row.contact_id,
    customerName: contactName(one(row.contacts)),
    teamId: row.team_id ?? "",
    createdAt: created,
    ...(row.expected_close ? { closeDate: Date.parse(`${row.expected_close}T12:00:00Z`) } : {}),
    ...(extra.lastCustomerAt ? { lastCustomerAt: extra.lastCustomerAt } : {}),
    ...(extra.followUp ? { followUp: extra.followUp } : {}),
    ...(latest
      ? {
          approval: {
            id: latest.id,
            byId: latest.requested_by ?? "",
            pct: Number(latest.percent),
            note: latest.note ?? "",
            status: latest.status,
            ...(latest.decided_by ? { decidedById: latest.decided_by } : {}),
          },
        }
      : {}),
    ...(row.lost_reason ? { lostReason: row.lost_reason } : {}),
    ...(row.closed_at ? { closedAt: Date.parse(row.closed_at) } : {}),
    notes: [...(row.deal_notes ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((n) => ({ byId: n.author_member_id ?? "", text: n.body, at: Date.parse(n.created_at) })),
  };
}

export function toBoardTask(row: TaskRow): BoardTask {
  const c = one(row.contacts);
  return {
    id: row.id,
    text: row.text,
    ownerId: row.owner_member_id ?? "",
    customerId: row.contact_id,
    customerName: row.contact_id ? contactName(c) : null,
    teamId: row.team_id ?? "",
    due: row.due_at ? Date.parse(row.due_at) : null,
    hasTime: row.has_time,
    done: row.done_at !== null,
    ...(row.done_at ? { doneAt: Date.parse(row.done_at) } : {}),
    repeat: row.repeat,
    comments: [...(row.task_notes ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((n) => ({ byId: n.author_member_id ?? "", text: n.body, at: Date.parse(n.created_at) })),
    calendar: null,
    ...(row.deal_id ? { dealId: row.deal_id } : {}),
  };
}

/** The stored words for what a lost reason can be. */
export const LOST_REASONS = ["Price", "Stock", "Went silent", "Competitor", "Other"] as const;

/** A money amount typed by a person ("1,250.50", "$1250") as minor units (cents). 0 when it isn't a number. */
export function toMinor(input: string): number {
  const n = Number(input.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
