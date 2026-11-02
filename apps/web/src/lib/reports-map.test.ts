import { describe, expect, it } from "vitest";
import { toReport, type ConversationsResult, type SalesResult } from "./reports-map";

const conv = (over: Partial<ConversationsResult> = {}): ConversationsResult => ({
  total: 10, prevTotal: 8, firstReplySeconds: 1200, resolutionSeconds: 7200, resolved: 4, backlog: 3,
  days: [{ day: "2026-11-03", n: 4 }, { day: "2026-11-04", n: 6 }],
  byChannel: [{ channel: "email", n: 6, firstReplySeconds: 30, resolved: 3 }, { channel: "voice", n: 4, firstReplySeconds: null, resolved: 1 }],
  heat: [{ dow: 0, block: 5, n: 2 }, { dow: 6, block: 11, n: 1 }],
  team: [
    { member: "m1", n: 2, firstReplySeconds: 600, resolved: 1, handedOver: 0, received: 1 },
    { member: "m2", n: 5, firstReplySeconds: null, resolved: 2, handedOver: 1, received: 0 },
  ],
  ...over,
});
const sales = (over: Partial<SalesResult> = {}): SalesResult => ({
  money: true, stages: [{ stage: "quoted", n: 2, value: 250_000 }], won: { n: 3, value: 900_000 }, lost: 1, reasons: [{ reason: "Price", n: 1 }], ...over,
});
const opts = { tz: "UTC", nameOf: (id: string) => (id === "m1" ? "Hana" : "Omar") };

describe("a real report in the screen's shape", () => {
  it("turns seconds into whole minutes, with at least one for anything quicker, and keeps empty as empty", () => {
    const r = toReport(conv({ firstReplySeconds: 20 }), sales(), opts);
    expect(r.firstReply).toBe(1);
    expect(r.resolution).toBe(120);
    expect(toReport(conv({ firstReplySeconds: null, resolutionSeconds: null }), sales(), opts)).toMatchObject({ firstReply: null, resolution: null });
  });
  it("works out percentages and says nothing when there is nothing to divide", () => {
    expect(toReport(conv(), sales(), opts).resolvedPct).toBe(40);
    const none = toReport(conv({ total: 0, resolved: 0, byChannel: [{ channel: "email", n: 0, firstReplySeconds: null, resolved: 0 }] }), sales(), opts);
    expect(none.resolvedPct).toBeNull();
    expect(none.byChannel[0]?.resolvedPct).toBeNull();
  });
  it("lays the busy times out as seven weekdays by twelve blocks", () => {
    const { heat } = toReport(conv(), sales(), opts);
    expect(heat).toHaveLength(7);
    expect(heat.every((row) => row.length === 12)).toBe(true);
    expect([heat[0]?.[5], heat[6]?.[11]]).toEqual([2, 1]);
  });
  it("names people and orders them by how many chats they handled", () => {
    expect(toReport(conv(), sales(), opts).team.map((t) => [t.name, t.n, t.firstReply])).toEqual([["Omar", 5, null], ["Hana", 2, 10]]);
  });
  it("lists the open stages in order, then won, in whole currency units", () => {
    const r = toReport(conv(), sales(), opts);
    expect(r.pipeline.map((p) => [p.stage, p.n, p.value])).toEqual([["new", 0, 0], ["quoted", 2, 2500], ["negotiating", 0, 0], ["won", 3, 9000]]);
    expect(r.lost).toEqual({ n: 1, reasons: [{ reason: "Price", n: 1 }] });
  });
  it("never invents satisfaction, campaigns or a reply-target number", () => {
    const r = toReport(conv(), sales(), opts);
    expect(r.csat).toBeUndefined();
    expect(r.campaigns).toBeUndefined();
    expect(r.withinTarget).toBeUndefined();
  });
  it("puts each day at midday in the workspace's zone", () => {
    const [d] = toReport(conv(), sales(), { ...opts, tz: "Asia/Dubai" }).days;
    expect(d?.at).toBe(Date.UTC(2026, 10, 3, 8, 0));
  });
});
