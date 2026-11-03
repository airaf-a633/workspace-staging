import type { RoleTemplateKey, Scope } from "@app/domain";
import type { en } from "../../i18n/messages/en";
import { dayDiff, wallClock, zonedInstant } from "../../i18n/zone";
import type { BoardDeal } from "../deals/sample";
import type { BoardTask } from "../tasks/sample";

/*
 * The numbers on a real Home (decided 2026-11-04): only ones that are computed from the workspace's real chats, deals and
 * tasks, never the made-up figures the preview shows. Roles keep their own set; a number nobody can compute yet
 * (revenue, median reply, orders, meetings) is left out; "over target" shows once the workspace has a reply-target rule until Reports and those features exist.
 */
export type StatKey = keyof typeof en.home.stats;
export type Value = { usd: number } | { min: number } | { n: number };

export const REAL_NUMBERS: Record<RoleTemplateKey, StatKey[]> = {
  owner: ["pipeline", "won", "openChats", "unassigned"],
  admin: ["pipeline", "won", "openChats", "unassigned"],
  sales_manager: ["pipeline", "won", "followUpsToday", "overdueTasks"],
  support_manager: ["openChats", "waitingCustomer", "overTarget", "unassigned"],
  ops_manager: ["tasksToday", "overdueTasks"],
  agent: ["yourOpenChats", "yourOpenDeals", "followUpsToday", "overdueTasks"],
  viewer: ["openChats", "waitingCustomer", "overTarget"],
};

export interface HomeFacts {
  template: RoleTemplateKey;
  meId: string;
  now: number;
  tz: string;
  /** The viewer's deals.values scope: money totals only show to those who may see every value. */
  dealValues: Scope;
  /** Chat counts from the same conversations the inbox shows. */
  chats: Partial<Record<StatKey, number>>;
  deals: BoardDeal[];
  tasks: BoardTask[];
}

/** A task is late once its time has passed; a task with only a day is late once that day is over. */
export function isLate(t: BoardTask, now: number, tz: string): boolean {
  if (t.done || t.due === null) return false;
  return t.hasTime ? t.due < now : dayDiff(t.due, now, tz) < 0;
}

/** This person's numbers, in the role's order. What the person may not see is simply not counted (row-level security). */
export function realNumbers(f: HomeFacts): { key: StatKey; value: Value }[] {
  const open = f.deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const w = wallClock(f.now, f.tz);
  const monthStart = zonedInstant(w.y, w.m, 1, 0, 0, f.tz);
  const money = f.dealValues === "all" || f.dealValues === "team";
  const mineToday = f.tasks.filter((t) => !t.done && t.ownerId === f.meId && t.due !== null && dayDiff(t.due, f.now, f.tz) === 0);

  const all: Partial<Record<StatKey, Value | undefined>> = {
    ...Object.fromEntries(Object.entries(f.chats).filter(([, n]) => n !== undefined).map(([k, n]) => [k, { n }])),
    pipeline: money ? { usd: open.reduce((sum, d) => sum + d.fils, 0) / 100 } : undefined,
    won: money ? { usd: f.deals.filter((d) => d.stage === "won" && (d.closedAt ?? 0) >= monthStart).reduce((sum, d) => sum + d.fils, 0) / 100 } : undefined,
    yourOpenDeals: { n: open.filter((d) => d.ownerId === f.meId).length },
    tasksToday: { n: f.tasks.filter((t) => !t.done && t.due !== null && dayDiff(t.due, f.now, f.tz) === 0).length },
    overdueTasks: { n: f.tasks.filter((t) => isLate(t, f.now, f.tz)).length },
    followUpsToday: { n: mineToday.length },
  };
  return REAL_NUMBERS[f.template].flatMap((key) => {
    const value = all[key];
    return value ? [{ key, value }] : [];
  });
}
