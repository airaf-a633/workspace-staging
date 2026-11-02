import { describe, expect, it } from "vitest";
import type { Viewer } from "@app/domain";
import type { BoardDeal } from "../deals/sample";
import type { BoardTask } from "../tasks/sample";
import { crmNeeds } from "./crm-needs";

const NOW = Date.UTC(2026, 10, 18, 12, 0);
const t = ((key: string, vars?: Record<string, string | number>) => `${key}${vars ? JSON.stringify(vars) : ""}`) as never;
const fmt = { money: (n: number) => `$${n / 100}` } as never;
const deal = (over: Partial<BoardDeal>): BoardDeal => ({ id: "d1", title: "Sofa", fils: 50_000, stage: "new", ownerId: "hana", customerId: "c1", customerName: "Lina", teamId: "deira", createdAt: NOW, notes: [], ...over });
const task = (over: Partial<BoardTask>): BoardTask => ({ id: "t1", text: "Call", ownerId: "sara", customerId: null, customerName: null, teamId: "deira", due: NOW, hasTime: false, done: false, repeat: null, comments: [], calendar: null, ...over });
const sara: Viewer = { memberId: "sara", teamIds: ["deira"], scopes: { "deals.approve": "team", "deals.values": "all" } };
const run = (over: Partial<Parameters<typeof crmNeeds>[0]>) =>
  crmNeeds({ deals: [], tasks: [], viewer: sara, nameOf: (id) => id, base: "/w/q", now: NOW, tz: "UTC", t, fmt, ...over });

describe("Needs-you-now rows from deals and tasks", () => {
  it("asks an approver to decide, but not the one who asked, and not someone whose scope doesn't reach", () => {
    const asked = deal({ approval: { byId: "hana", pct: 10, note: "", status: "pending" } });
    expect(run({ deals: [asked] }).map((r) => r.id)).toEqual(["approve-d1"]);
    expect(run({ deals: [deal({ approval: { byId: "sara", pct: 10, note: "", status: "pending" } })] })).toEqual([]);
    expect(run({ deals: [asked], viewer: { ...sara, scopes: { "deals.approve": "none" } } })).toEqual([]);
    expect(run({ deals: [deal({ approval: { byId: "hana", pct: 10, note: "", status: "approved" } })] })).toEqual([]);
  });
  it("lists my quoted deals, with the value only if I may see it", () => {
    const quoted = deal({ stage: "quoted", ownerId: "sara" });
    expect(run({ deals: [quoted] })[0]?.items[0]).toContain("quoteValue");
    expect(run({ deals: [quoted], viewer: { ...sara, scopes: { "deals.values": "none" } } })[0]?.items[0]).toBe("needs.quote");
    expect(run({ deals: [deal({ stage: "quoted", ownerId: "hana" })] })).toEqual([]);
  });
  it("lists my tasks that are late or due today, and nothing else", () => {
    const rows = run({
      tasks: [
        task({ id: "a", due: NOW }),
        task({ id: "b", due: NOW - 2 * 86_400_000 }),
        task({ id: "c", due: NOW + 86_400_000 }),
        task({ id: "d", ownerId: "hana" }),
        task({ id: "e", done: true }),
        task({ id: "f", due: null }),
      ],
    });
    expect(rows.map((r) => [r.id, r.rank, r.tone])).toEqual([["task-a", 3, "plain"], ["task-b", 1, "warn"]]);
    expect(rows[1]?.items[0]).toContain("taskLate");
  });
});
