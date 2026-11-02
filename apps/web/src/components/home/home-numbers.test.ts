import { describe, expect, it } from "vitest";
import type { BoardDeal } from "../deals/sample";
import type { BoardTask } from "../tasks/sample";
import { isLate, realNumbers, type HomeFacts } from "./home-numbers";

const TZ = "UTC";
const NOW = Date.UTC(2026, 10, 18, 12, 0); // 18 Nov 2026, noon
const DAY = 86_400_000;
const deal = (over: Partial<BoardDeal>): BoardDeal => ({
  id: "d", title: "Sofa", fils: 100_00, stage: "new", ownerId: "me", customerId: null, customerName: "Lina", teamId: "t", createdAt: NOW, notes: [], ...over,
});
const task = (over: Partial<BoardTask>): BoardTask => ({
  id: "t", text: "Call", ownerId: "me", customerId: null, customerName: null, teamId: "t", due: null, hasTime: false, done: false, repeat: null, comments: [], calendar: null, ...over,
});
const facts = (over: Partial<HomeFacts>): HomeFacts => ({ template: "owner", meId: "me", now: NOW, tz: TZ, dealValues: "all", chats: { openChats: 4, unassigned: 1 }, deals: [], tasks: [], ...over });

describe("a real Home's numbers", () => {
  it("adds up open pipeline and this month's wins in whole currency units", () => {
    const out = realNumbers(facts({
      deals: [
        deal({ fils: 250_000, stage: "quoted" }),
        deal({ fils: 50_000, stage: "negotiating" }),
        deal({ fils: 900_000, stage: "won", closedAt: Date.UTC(2026, 10, 3) }),
        deal({ fils: 700_000, stage: "won", closedAt: Date.UTC(2026, 9, 28) }),
        deal({ fils: 800_000, stage: "lost" }),
      ],
    }));
    expect(out.find((o) => o.key === "pipeline")?.value).toEqual({ usd: 3000 });
    expect(out.find((o) => o.key === "won")?.value).toEqual({ usd: 9000 });
  });
  it("follows the role's order and leaves out what can't be computed", () => {
    expect(realNumbers(facts({})).map((o) => o.key)).toEqual(["pipeline", "won", "openChats", "unassigned"]);
    expect(realNumbers(facts({ template: "support_manager", chats: { openChats: 2, waitingCustomer: 1, unassigned: 0 } })).map((o) => o.key)).toEqual(["openChats", "waitingCustomer", "unassigned"]);
  });
  it("shows no money to someone who can see only their own deals' values, or none", () => {
    for (const dealValues of ["own", "none"] as const) {
      expect(realNumbers(facts({ dealValues, deals: [deal({})] })).map((o) => o.key)).toEqual(["openChats", "unassigned"]);
    }
  });
  it("counts an agent's own open deals and tasks due today", () => {
    const out = realNumbers(facts({
      template: "agent",
      chats: { yourOpenChats: 3 },
      deals: [deal({}), deal({ stage: "quoted" }), deal({ ownerId: "other" }), deal({ stage: "won" })],
      tasks: [task({ due: NOW }), task({ due: NOW + DAY }), task({ ownerId: "other", due: NOW }), task({ due: NOW, done: true })],
    }));
    expect(Object.fromEntries(out.map((o) => [o.key, o.value]))).toEqual({
      yourOpenChats: { n: 3 }, yourOpenDeals: { n: 2 }, followUpsToday: { n: 1 }, overdueTasks: { n: 0 },
    });
  });
  it("calls a timed task late once its time passes, and a day-only task late only after that day", () => {
    expect(isLate(task({ due: NOW - 3_600_000, hasTime: true }), NOW, TZ)).toBe(true);
    expect(isLate(task({ due: NOW + 3_600_000, hasTime: true }), NOW, TZ)).toBe(false);
    expect(isLate(task({ due: Date.UTC(2026, 10, 18, 0, 0) }), NOW, TZ)).toBe(false);
    expect(isLate(task({ due: Date.UTC(2026, 10, 17, 0, 0) }), NOW, TZ)).toBe(true);
    expect(isLate(task({ due: Date.UTC(2026, 10, 1), done: true }), NOW, TZ)).toBe(false);
    expect(isLate(task({ due: null }), NOW, TZ)).toBe(false);
  });
});
