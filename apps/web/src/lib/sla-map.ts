import type { ChannelKey } from "../components/channels/catalog";
import type { Closure, ServerClock, SlaPolicy, Target, WeekHours } from "../components/sla/sla";

/**
 * Reply targets as the database stores them (migration 20261106000001_reply_targets), mapped to the shapes the screens
 * use. Hours are minutes after midnight in the database and "HH:MM" on screen ("24:00" closes at midnight).
 */

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toHhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export interface HoursRow {
  weekday: number;
  opens: number;
  closes: number;
}

/** Seven days, Monday first; a day with no row is closed. */
export function weekFromRows(rows: HoursRow[]): WeekHours {
  const week: WeekHours = Array.from({ length: 7 }, () => null);
  for (const r of rows) if (r.weekday >= 0 && r.weekday <= 6) week[r.weekday] = [toHhmm(r.opens), toHhmm(r.closes)];
  return week;
}

/** What save_team_hours takes: null for a closed day, otherwise minutes after midnight. */
export function weekToJson(week: WeekHours): ({ opens: number; closes: number } | null)[] {
  return week.map((d) => (d ? { opens: toMinutes(d[0]), closes: toMinutes(d[1]) } : null));
}

export interface ClosureRow {
  id: string;
  from_date: string;
  to_date: string;
  opens: number | null;
  closes: number | null;
  label: string | null;
}

export function closureFromRow(r: ClosureRow): Closure {
  return {
    id: r.id,
    from: r.from_date,
    to: r.to_date,
    hours: r.opens !== null && r.closes !== null ? [toHhmm(r.opens), toHhmm(r.closes)] : null,
    label: r.label ?? "",
  };
}

export interface PolicyRow {
  id: string;
  name: string;
  active: boolean;
  team_ids: string[];
  channel_types: string[];
  vip: boolean;
  first_reply_min: number | null;
  next_reply_min: number | null;
  resolution_min: number | null;
}

export function policyFromRow(r: PolicyRow): SlaPolicy {
  return {
    id: r.id,
    name: r.name,
    active: r.active,
    match: {
      ...(r.team_ids.length ? { teams: r.team_ids } : {}),
      ...(r.channel_types.length ? { channels: r.channel_types as ChannelKey[] } : {}),
      ...(r.vip ? { vip: true } : {}),
    },
    firstReply: r.first_reply_min,
    nextReply: r.next_reply_min,
    resolution: r.resolution_min,
  };
}

/** The clock rows sla_clocks() returns (numeric columns can arrive as strings). */
export interface ClockRow {
  conversation_id: string;
  target: string;
  used: number | string;
  limit_min: number;
  state: string;
  running: boolean;
  policy: string;
}

const TARGET: Record<string, Target> = { first_reply: "firstReply", next_reply: "nextReply", resolution: "resolution" };

/** Clocks grouped by chat. A row this version does not understand is skipped rather than shown wrongly. */
export function clocksByConversation(rows: ClockRow[]): Map<string, ServerClock[]> {
  const out = new Map<string, ServerClock[]>();
  for (const r of rows) {
    const target = TARGET[r.target];
    if (!target || (r.state !== "ok" && r.state !== "warn" && r.state !== "breach")) continue;
    const list = out.get(r.conversation_id) ?? [];
    list.push({ target, used: Number(r.used), limit: r.limit_min, state: r.state, running: r.running, policy: r.policy });
    out.set(r.conversation_id, list);
  }
  return out;
}

/** The target a stored notice is about, in the words the screens use. */
export function noticeTarget(v: string | null): Target | undefined {
  return v ? TARGET[v] : undefined;
}
