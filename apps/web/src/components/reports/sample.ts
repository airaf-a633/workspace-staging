import type { ChannelKey } from "@/components/channels/catalog";

/**
 * Sample report numbers for Northwind Home (decided 2026-10-07: conversations, team, satisfaction, sales and
 * campaigns). Seeded, so the server and the browser compute the same figures and a filter always shows the
 * same answer. Real reports will read the same shapes from the database.
 */

export type Range = 7 | 30 | 90;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/** Share of conversations per channel, roughly what an online home brand sees. */
const CHANNEL_SHARE: [ChannelKey, number][] = [
  ["whatsapp", 0.27],
  ["webchat", 0.2],
  ["email", 0.18],
  ["instagram", 0.12],
  ["messenger", 0.06],
  ["sms", 0.05],
  ["voice", 0.04],
  ["telegram", 0.03],
  ["tiktok", 0.02],
  ["line", 0.015],
  ["slack", 0.01],
  ["discord", 0.005],
];
/** Typical first-reply minutes per channel: chat is fast, email slow. */
const REPLY_BASE: Partial<Record<ChannelKey, number>> = { whatsapp: 6, webchat: 3, email: 95, instagram: 14, messenger: 12, sms: 9, voice: 0, telegram: 8, tiktok: 22, line: 10, slack: 25, discord: 40 };

export interface ReportFilters {
  range: Range;
  team: string;
  channel: ChannelKey | "all";
}

export interface Agent {
  id: string;
  name: string;
  team: string;
}

export function buildReport(f: ReportFilters, agents: Agent[], now: number) {
  const r = rng(hash(`${f.range}|${f.team}|${f.channel}`));
  const teamShare = f.team === "all" ? 1 : f.team.includes("sales") ? 0.55 : 0.45;
  const channels = CHANNEL_SHARE.filter(([c]) => f.channel === "all" || c === f.channel);
  const chShare = channels.reduce((s, [, x]) => s + x, 0);

  // Conversations per day, with a weekday rhythm and a gentle upward trend.
  const DAY = 86_400_000;
  const days = Array.from({ length: f.range }, (_, i) => {
    const at = now - (f.range - 1 - i) * DAY;
    const wd = new Date(at).getUTCDay();
    const weekday = wd === 0 ? 0.6 : wd === 6 ? 0.75 : 1;
    const trend = 1 + (i / f.range) * 0.12;
    return { at, n: Math.round(118 * teamShare * chShare * weekday * trend * (0.85 + r() * 0.3)) };
  });
  const total = days.reduce((s, d) => s + d.n, 0);
  const prevTotal = Math.round(total * (0.86 + r() * 0.1));

  const byChannel = channels.map(([key, share]) => {
    const n = Math.round(total * (share / chShare));
    const base = REPLY_BASE[key] ?? 15;
    return {
      key,
      n,
      firstReply: key === "voice" ? null : Math.max(1, Math.round(base * (0.8 + r() * 0.4))),
      resolvedPct: Math.round(78 + r() * 18),
      csat: Math.round(82 + r() * 15),
    };
  });

  const weighted = (pick: (c: (typeof byChannel)[number]) => number | null) => {
    const rows = byChannel.filter((c) => pick(c) !== null);
    const n = rows.reduce((s, c) => s + c.n, 0) || 1;
    return Math.round(rows.reduce((s, c) => s + (pick(c) ?? 0) * c.n, 0) / n);
  };

  // Busy times: 7 weekdays x 12 two-hour blocks (Monday first).
  const heat = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 12 }, (_, h) => {
      const hour = h * 2;
      const daytime = hour >= 8 && hour <= 20 ? 1 : hour >= 6 && hour <= 22 ? 0.35 : 0.08;
      const lunch = hour === 12 ? 1.2 : 1;
      const weekend = d >= 5 ? 0.6 : 1;
      return Math.round((total / (f.range * 4)) * daytime * lunch * weekend * (0.7 + r() * 0.6));
    }),
  );

  // Each person's share of the period's conversations; the shares add up to the total.
  const members = agents.filter((a) => f.team === "all" || a.team === f.team);
  const weights = members.map(() => 0.6 + r() * 0.8);
  const weightSum = weights.reduce((s, w) => s + w, 0) || 1;
  const team = members
    .map((a, i) => {
      const n = Math.round((total * weights[i]) / weightSum);
      return {
        ...a,
        n,
        firstReply: Math.round(4 + r() * 18),
        resolved: Math.round(n * (0.75 + r() * 0.2)),
        csat: Math.round(80 + r() * 18),
        handoversOut: Math.round(n * (0.04 + r() * 0.08)),
        handoversIn: Math.round(n * (0.03 + r() * 0.08)),
      };
    })
    .sort((a, b) => b.n - a.n);

  const responses = Math.round(total * 0.31);
  const dist = [0.66, 0.19, 0.07, 0.04, 0.04].map((p) => Math.round(responses * p * (0.9 + r() * 0.2)));
  const csatScore = Math.round(((dist[0] + dist[1]) / Math.max(1, dist.reduce((s, x) => s + x, 0))) * 100);

  const pipeline = [
    { stage: "new" as const, n: Math.round(14 * teamShare), value: Math.round(18_400 * teamShare) },
    { stage: "quoted" as const, n: Math.round(9 * teamShare), value: Math.round(21_700 * teamShare) },
    { stage: "negotiating" as const, n: Math.round(5 * teamShare), value: Math.round(25_700 * teamShare) },
    { stage: "won" as const, n: Math.round(11 * teamShare * (f.range / 30)), value: Math.round(19_560 * teamShare * (f.range / 30)) },
  ];

  const campaigns = [
    { name: "Autumn lighting launch", channel: "email" as ChannelKey, sent: 8_420, delivered: 8_211, read: 3_940, replied: 212, orders: 164 },
    { name: "Back in stock: Halo desk lamp", channel: "whatsapp" as ChannelKey, sent: 1_260, delivered: 1_244, read: 1_102, replied: 188, orders: 97 },
    { name: "Breeze filter reminder", channel: "sms" as ChannelKey, sent: 2_030, delivered: 1_986, read: 0, replied: 41, orders: 133 },
  ].filter((c) => f.channel === "all" || c.channel === f.channel);

  return {
    days,
    total,
    prevTotal,
    firstReply: weighted((c) => c.firstReply),
    resolution: Math.round(3.2 * 60 * (0.8 + r() * 0.4)),
    resolvedPct: weighted((c) => c.resolvedPct),
    backlog: Math.round(total * 0.06),
    byChannel: byChannel.sort((a, b) => b.n - a.n),
    heat,
    team,
    csat: { score: csatScore, responses, dist, comments: COMMENTS.filter((c) => f.channel === "all" || c.channel === f.channel) },
    pipeline,
    campaigns,
  };
}

export type Report = ReturnType<typeof buildReport>;

/** Customers' own words, shown as written. */
const COMMENTS: { name: string; channel: ChannelKey; score: number; text: string; agent: string }[] = [
  { name: "Mariam Haddad", channel: "whatsapp", score: 5, text: "Kenji called before arriving, exactly as promised. Lamps look perfect in the lobby.", agent: "Kenji" },
  { name: "Deepak Nair", channel: "webchat", score: 5, text: "Quick and clear answer about shipping to Singapore.", agent: "Leo" },
  { name: "Aiko Tanaka", channel: "line", score: 4, text: "Adapter arrived fast. Would be nice if it was in the box.", agent: "Priya" },
  { name: "Grace Kim", channel: "voice", score: 2, text: "Had to call twice before anyone picked up.", agent: "Leo" },
  { name: "Lukas Weber", channel: "email", score: 5, text: "Very organised with the pallet and paperwork.", agent: "Kenji" },
];
