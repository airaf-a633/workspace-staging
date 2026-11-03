import type { ChannelKey } from "@/components/channels/catalog";
import type { Conversation } from "@/components/inbox/types";
import { wallClock, zonedInstant } from "../../i18n/zone";

/**
 * Reply targets (SLAs), decided 2026-10-07 and settled for real data on 2026-11-03:
 * - Policies match by team, channel and VIP; each sets first reply, next reply and resolution targets.
 * - When several match, the strictest target wins, per target.
 * - The clock only runs inside the team's opening hours (workspace zone), minus closed days, and stops while the team waits on the customer.
 * - Warn at the workspace's share of a target (default 80%); breach at 100%.
 * The preview works the clocks out here from the sample messages. In a real workspace the database works them out
 * (migration 20261106000001_reply_targets) and each chat carries them as `slaClocks`.
 */

export interface SlaPolicy {
  id: string;
  name: string;
  active: boolean;
  match: { teams?: string[]; channels?: ChannelKey[]; vip?: boolean };
  /** Minutes of business time; null means this policy doesn't set that target. */
  firstReply: number | null;
  nextReply: number | null;
  resolution: number | null;
}

/** Opening hours per weekday, Monday first, as "HH:MM" pairs; null = closed all day. "24:00" closes at midnight. */
export type WeekHours = ([string, string] | null)[];

/** A date or run of dates (YYYY-MM-DD, both included) that is closed (hours null) or has its own hours. */
export interface Closure {
  id: string;
  from: string;
  to: string;
  hours: [string, string] | null;
  label: string;
}

export interface TeamSchedule {
  week: WeekHours;
  closures: Closure[];
}

export interface SlaSettings {
  tz: string;
  /** Opening hours by team id. */
  schedules: Record<string, TeamSchedule>;
  policies: SlaPolicy[];
  warnAt: number;
  alertManager: boolean;
  /** Real workspaces: the database works the clocks out and each chat carries them. */
  live?: boolean;
}

export type Target = "firstReply" | "nextReply" | "resolution";

export interface SlaClock {
  target: Target;
  /** Business minutes used so far, and the target. */
  used: number;
  limit: number;
  state: "ok" | "warn" | "breach" | "paused";
  policy: string;
}

/** One running clock on a chat as the database reports it. Resolution keeps its state while the team waits on the customer. */
export interface ServerClock {
  target: Target;
  used: number;
  limit: number;
  state: "ok" | "warn" | "breach";
  running: boolean;
  policy: string;
}

const MIN = 60_000;

export function isVip(c: Conversation) {
  return c.contact.tags.includes("VIP") || !!c.labels?.includes("l-vip");
}

/** The strictest target of every active policy that matches, with the policy it came from. */
export function targetsFor(c: Conversation, policies: SlaPolicy[]) {
  const matching = policies.filter(
    (p) =>
      p.active &&
      (!p.match.teams?.length || p.match.teams.includes(c.teamId)) &&
      (!p.match.channels?.length || p.match.channels.includes(c.channel)) &&
      (!p.match.vip || isVip(c)),
  );
  const pick = (k: Target) => {
    let best: { limit: number; policy: string } | null = null;
    for (const p of matching) {
      const v = p[k];
      if (v !== null && (!best || v < best.limit)) best = { limit: v, policy: p.name };
    }
    return best;
  };
  return { firstReply: pick("firstReply"), nextReply: pick("nextReply"), resolution: pick("resolution") };
}

const pad = (n: number) => String(n).padStart(2, "0");
const hm = (v: string) => v.split(":").map(Number) as [number, number];

/**
 * Business minutes between two instants, counting only the schedule's opening hours in the workspace zone. A closed
 * day counts nothing; a day with its own hours uses those.
 */
export function businessMinutes(from: number, to: number, schedule: TeamSchedule, tz: string) {
  if (to <= from) return 0;
  let total = 0;
  // Walk day by day (from the day of `from`); conversations in the sample span at most a few weeks.
  for (let day = 0; day < 120; day++) {
    const w = wallClock(from, tz);
    const dayStart = zonedInstant(w.y, w.m, w.d + day, 0, 0, tz);
    if (dayStart > to) break;
    const noon = wallClock(dayStart + 12 * 3600_000, tz);
    const key = `${noon.y}-${pad(noon.m)}-${pad(noon.d)}`;
    const closure = schedule.closures.find((c) => c.from <= key && key <= c.to);
    const open = closure ? closure.hours : schedule.week[noon.weekday];
    if (!open) continue;
    const [oh, om] = hm(open[0]);
    const [ch, cm] = hm(open[1]);
    const a = Math.max(from, zonedInstant(w.y, w.m, w.d + day, oh, om, tz));
    const b = Math.min(to, zonedInstant(w.y, w.m, w.d + day, ch, cm, tz));
    if (b > a) total += (b - a) / MIN;
  }
  return Math.round(total);
}

/** The most urgent of a chat's running clocks: a breach before a warning before the rest; a reply that is owed before a resolution. */
export function worstClock(rows: ServerClock[]): SlaClock | null {
  if (rows.length === 0) return null;
  const score = (r: ServerClock) => ({ breach: 30, warn: 20, ok: 10 })[r.state] + (r.running ? (r.target === "resolution" ? 1 : 2) : 0);
  const best = rows.reduce((a, b) => (score(b) > score(a) || (score(b) === score(a) && b.used / b.limit > a.used / a.limit) ? b : a));
  return { target: best.target, used: best.used, limit: best.limit, state: !best.running && best.state === "ok" ? "paused" : best.state, policy: best.policy };
}

const EMPTY: TeamSchedule = { week: [], closures: [] };

/**
 * The clock that matters now for a conversation, or null when no target applies (resolved, spam, or no
 * matching policy). Real chats carry the database's answer. In the preview, who wrote last decides which clock
 * runs: the customer → a reply is owed; us → paused.
 */
export function slaClock(c: Conversation, s: SlaSettings, now: number): SlaClock | null {
  if (c.status !== "open") return null;
  if (c.slaClocks) return worstClock(c.slaClocks);
  if (s.live) return null;
  const real = c.messages.filter((m) => m.kind === "in" || m.kind === "out");
  if (real.length === 0) return null;
  const schedule = s.schedules[c.teamId] ?? Object.values(s.schedules)[0] ?? EMPTY;
  const targets = targetsFor(c, s.policies);
  const last = real[real.length - 1];
  const firstIn = real.find((m) => m.kind === "in");
  const answered = real.some((m) => m.kind === "out");
  const state = (used: number, limit: number): SlaClock["state"] => (used >= limit ? "breach" : used >= limit * s.warnAt ? "warn" : "ok");

  if (last.kind === "in") {
    // A reply is owed: first reply if nobody has answered yet, otherwise the next reply.
    const target: Target = answered ? "nextReply" : "firstReply";
    const t = targets[target];
    if (!t) return null;
    // The clock starts at the first unanswered customer message in this run.
    let start = last.at;
    for (let i = real.length - 1; i >= 0 && real[i].kind === "in"; i--) start = real[i].at;
    const used = businessMinutes(start, now, schedule, s.tz);
    return { target, used, limit: t.limit, state: state(used, t.limit), policy: t.policy };
  }
  // We wrote last: the reply clocks stop; resolution pauses until the customer writes again.
  const t = targets.resolution;
  if (!t || !firstIn) return null;
  let used = 0;
  let waiting: number | null = null;
  for (const m of real) {
    if (m.at < firstIn.at) continue;
    if (m.kind === "in" && waiting === null) waiting = m.at;
    if (m.kind === "out" && waiting !== null) {
      used += businessMinutes(waiting, m.at, schedule, s.tz);
      waiting = null;
    }
  }
  return { target: "resolution", used, limit: t.limit, state: used >= t.limit ? "breach" : "paused", policy: t.policy };
}
