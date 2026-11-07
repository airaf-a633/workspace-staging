import type { ChannelKey } from "../components/channels/catalog";
import type { Report } from "../components/reports/sample";
import { zonedInstant } from "../i18n/zone";

/** What report_conversations() returns (migration 20261105000001_reports). Seconds are medians; counts are whole numbers. */
export interface ConversationsResult {
  total: number;
  prevTotal: number;
  firstReplySeconds: number | null;
  resolutionSeconds: number | null;
  resolved: number;
  backlog: number;
  /** Chats the rules gave a first-reply target and that can be judged, and how many were answered inside it (migration 20261106000001). */
  withinTarget?: { n: number; ok: number };
  days: { day: string; n: number }[];
  byChannel: { channel: string; n: number; firstReplySeconds: number | null; resolved: number }[];
  heat: { dow: number; block: number; n: number }[];
  team: { member: string; n: number; firstReplySeconds: number | null; resolved: number; handedOver: number; received: number }[];
}

/** What report_sales() returns. Amounts are in the smallest currency unit and null when this person may not see values. */
export interface SalesResult {
  money: boolean;
  stages: { stage: string; n: number; value: number | null }[];
  won: { n: number; value: number | null };
  lost: number;
  reasons: { reason: string; n: number }[];
}

const OPEN_STAGES = ["new", "quoted", "negotiating"] as const;

/** Seconds to whole minutes; anything that took any time at all shows as at least one. */
const minutes = (seconds: number | null) => (seconds === null ? null : Math.max(1, Math.round(seconds / 60)));
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/**
 * The real report in the shape the Reports screen draws. Satisfaction and campaigns are left out (nothing measures them yet),
 * and so is "within target" until a reply-target rule has judged at least one chat; the screen hides what is missing.
 */
export function toReport(c: ConversationsResult, sales: SalesResult, opts: { tz: string; nameOf: (memberId: string) => string }): Report {
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 0));
  for (const h of c.heat) if (heat[h.dow] && h.block >= 0 && h.block < 12) heat[h.dow]![h.block] = h.n;
  const stage = (key: string) => sales.stages.find((s) => s.stage === key);
  const units = (minor: number | null | undefined) => (minor ?? 0) / 100;

  return {
    days: c.days.map((d) => {
      const [y, m, day] = d.day.split("-").map(Number) as [number, number, number];
      return { at: zonedInstant(y, m, day, 12, 0, opts.tz), n: d.n };
    }),
    total: c.total,
    prevTotal: c.prevTotal,
    firstReply: minutes(c.firstReplySeconds),
    resolution: minutes(c.resolutionSeconds),
    resolvedPct: pct(c.resolved, c.total),
    backlog: c.backlog,
    ...(c.withinTarget && c.withinTarget.n > 0 ? { withinTarget: pct(c.withinTarget.ok, c.withinTarget.n) ?? 0 } : {}),
    byChannel: c.byChannel.map((x) => ({ key: x.channel as ChannelKey, n: x.n, firstReply: minutes(x.firstReplySeconds), resolvedPct: pct(x.resolved, x.n) })),
    heat,
    team: c.team
      .map((m) => ({ id: m.member, name: opts.nameOf(m.member), n: m.n, firstReply: minutes(m.firstReplySeconds), resolved: m.resolved, handoversOut: m.handedOver, handoversIn: m.received }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
    pipeline: [
      ...OPEN_STAGES.map((key) => ({ stage: key, n: stage(key)?.n ?? 0, value: units(stage(key)?.value) })),
      { stage: "won" as const, n: sales.won.n, value: units(sales.won.value) },
    ],
    lost: { n: sales.lost, reasons: sales.reasons },
  };
}
