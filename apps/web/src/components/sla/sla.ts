import type { ChannelKey } from "@/components/channels/catalog";
import type { Conversation } from "@/components/inbox/types";
import { wallClock, zonedInstant } from "@/i18n/zone";

/**
 * Reply targets (SLAs), decided 2026-10-07:
 * - Policies match by team, channel and VIP; each sets first reply, next reply and resolution targets.
 * - When several match, the strictest target wins, per target.
 * - The clock only runs inside business hours (workspace zone) and stops while the team waits on the customer.
 * - Warn at 80% of a target; breach at 100%.
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

/** Opening hours per weekday, Monday first, as "HH:MM" pairs; null = closed all day. */
export type WeekHours = ([string, string] | null)[];

export interface SlaSettings {
  tz: string;
  hours: WeekHours;
  policies: SlaPolicy[];
  warnAt: number;
  alertManager: boolean;
  reassignOnBreach: boolean;
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

/** Business minutes between two instants, counting only opening hours in the workspace zone. */
export function businessMinutes(from: number, to: number, hours: WeekHours, tz: string) {
  if (to <= from) return 0;
  let total = 0;
  // Walk day by day (from the day of `from`); conversations in the sample span at most a few weeks.
  for (let day = 0; day < 120; day++) {
    const w = wallClock(from, tz);
    const dayStart = zonedInstant(w.y, w.m, w.d + day, 0, 0, tz);
    if (dayStart > to) break;
    const open = hours[wallClock(dayStart + 12 * 3600_000, tz).weekday];
    if (!open) continue;
    const [oh, om] = open[0].split(":").map(Number);
    const [ch, cm] = open[1].split(":").map(Number);
    const a = Math.max(from, zonedInstant(w.y, w.m, w.d + day, oh, om, tz));
    const b = Math.min(to, zonedInstant(w.y, w.m, w.d + day, ch, cm, tz));
    if (b > a) total += (b - a) / MIN;
  }
  return Math.round(total);
}

/**
 * The clock that matters now for a conversation, or null when no target applies (resolved, spam, or no
 * matching policy). Who wrote last decides which clock runs: the customer → a reply is owed; us → paused.
 */
export function slaClock(c: Conversation, s: SlaSettings, now: number): SlaClock | null {
  if (c.status !== "open") return null;
  const real = c.messages.filter((m) => m.kind === "in" || m.kind === "out");
  if (real.length === 0) return null;
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
    const used = businessMinutes(start, now, s.hours, s.tz);
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
      used += businessMinutes(waiting, m.at, s.hours, s.tz);
      waiting = null;
    }
  }
  return { target: "resolution", used, limit: t.limit, state: "paused", policy: t.policy };
}
