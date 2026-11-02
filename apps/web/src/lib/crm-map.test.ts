import { describe, expect, it } from "vitest";
import { dueWord, toBoardDeal, toBoardTask, toMinor, type DealRow, type TaskRow } from "./crm-map";

const TZ = "Asia/Dubai";
const NOW = Date.UTC(2026, 10, 3, 8, 0); // Tuesday 3 November 2026, noon in Dubai
const DAY = 86_400_000;

const deal = (over: Partial<DealRow> = {}): DealRow => ({
  id: "d1", title: "Sofa set", status: "open", contact_id: "c1", owner_member_id: "m1", team_id: "t1", expected_close: null, lost_reason: null,
  closed_at: null, created_at: "2026-11-01T10:00:00Z", pipeline_stages: { key: "quoted" }, deal_values: { value_minor: 100000 },
  contacts: { name: "Rana Aziz", profile_name: null, email: null, phone: null }, deal_notes: [], deal_approvals: [], ...over,
});

describe("a due moment as a word", () => {
  it("names today, tomorrow, the days after and the late", () => {
    expect(dueWord(null, NOW, TZ)).toBe("No date");
    expect(dueWord(NOW + 2 * 3600_000, NOW, TZ)).toBe("Today");
    expect(dueWord(NOW + DAY, NOW, TZ)).toBe("Tomorrow");
    expect(dueWord(NOW + 2 * DAY, NOW, TZ)).toBe("Thursday");
    expect(dueWord(NOW + 6 * DAY, NOW, TZ)).toBe("Monday");
    expect(dueWord(NOW + 7 * DAY, NOW, TZ)).toBe("10 Nov");
    expect(dueWord(NOW - DAY, NOW, TZ)).toBe("Late");
  });
});

describe("a deal on the board", () => {
  it("maps an open deal with its stage, value and owner", () => {
    expect(toBoardDeal(deal())).toMatchObject({ id: "d1", title: "Sofa set", fils: 100000, stage: "quoted", ownerId: "m1", customerId: "c1", customerName: "Rana Aziz", teamId: "t1", notes: [] });
  });

  it("uses the outcome as the stage once closed, with its reason", () => {
    const lost = toBoardDeal(deal({ status: "lost", lost_reason: "Price", closed_at: "2026-11-02T09:00:00Z" }));
    expect(lost).toMatchObject({ stage: "lost", lostReason: "Price" });
    expect(lost.closedAt).toBe(Date.parse("2026-11-02T09:00:00Z"));
    expect(toBoardDeal(deal({ status: "won", closed_at: "2026-11-02T09:00:00Z" })).stage).toBe("won");
  });

  it("shows no money when the role may not see it, and reads a list as well as an object", () => {
    expect(toBoardDeal(deal({ deal_values: null })).fils).toBe(0);
    expect(toBoardDeal(deal({ deal_values: [{ value_minor: "250000" }], pipeline_stages: [{ key: "negotiating" }] }))).toMatchObject({ fils: 250000, stage: "negotiating" });
  });

  it("falls back through the customer's names, and says so when there is none", () => {
    expect(toBoardDeal(deal({ contacts: { name: null, profile_name: "Rana A", email: null, phone: null } })).customerName).toBe("Rana A");
    expect(toBoardDeal(deal({ contacts: { name: null, profile_name: null, email: "r@x.co", phone: null } })).customerName).toBe("r@x.co");
    expect(toBoardDeal(deal({ contacts: null, contact_id: null })).customerName).toBe("No customer");
  });

  it("carries the latest discount request, and notes oldest first", () => {
    const d = toBoardDeal(deal({
      deal_approvals: [
        { id: "a1", requested_by: "m2", percent: "5.00", note: "first", status: "declined", decided_by: "m3", created_at: "2026-11-01T11:00:00Z" },
        { id: "a2", requested_by: "m2", percent: "10.00", note: "Loyal", status: "pending", decided_by: null, created_at: "2026-11-02T11:00:00Z" },
      ],
      deal_notes: [
        { author_member_id: "m1", body: "second", created_at: "2026-11-02T10:00:00Z" },
        { author_member_id: "m2", body: "first", created_at: "2026-11-01T10:00:00Z" },
      ],
    }));
    expect(d.approval).toEqual({ id: "a2", byId: "m2", pct: 10, note: "Loyal", status: "pending" });
    expect(d.notes.map((n) => n.text)).toEqual(["first", "second"]);
  });

  it("passes the follow-up and the customer's last message through", () => {
    expect(toBoardDeal(deal(), { followUp: { text: "Call", due: "Today" }, lastCustomerAt: 5 })).toMatchObject({ followUp: { text: "Call", due: "Today" }, lastCustomerAt: 5 });
  });

  it("reads the expected close as a date", () => {
    expect(toBoardDeal(deal({ expected_close: "2026-11-20" })).closeDate).toBe(Date.parse("2026-11-20T12:00:00Z"));
  });
});

const task = (over: Partial<TaskRow> = {}): TaskRow => ({
  id: "t1", text: "Call back", owner_member_id: "m1", team_id: "t1", contact_id: "c1", deal_id: null, due_at: "2026-11-04T05:00:00Z", has_time: true,
  repeat: "weekly", done_at: null, contacts: { name: "Rana Aziz", profile_name: null, email: null, phone: null }, task_notes: [], ...over,
});

describe("a task on the list", () => {
  it("maps an open repeating task with its customer", () => {
    expect(toBoardTask(task())).toMatchObject({ id: "t1", text: "Call back", ownerId: "m1", customerId: "c1", customerName: "Rana Aziz", due: Date.parse("2026-11-04T05:00:00Z"), hasTime: true, done: false, repeat: "weekly", calendar: null });
  });

  it("maps a finished task with no date and no customer, and its deal", () => {
    expect(toBoardTask(task({ done_at: "2026-11-03T07:00:00Z", due_at: null, contact_id: null, contacts: null, repeat: null, deal_id: "d9" }))).toMatchObject({
      done: true, doneAt: Date.parse("2026-11-03T07:00:00Z"), due: null, customerId: null, customerName: null, dealId: "d9",
    });
  });

  it("lists notes oldest first", () => {
    const t = toBoardTask(task({ task_notes: [{ author_member_id: "m2", body: "b", created_at: "2026-11-03T10:00:00Z" }, { author_member_id: "m1", body: "a", created_at: "2026-11-03T09:00:00Z" }] }));
    expect(t.comments.map((c) => c.text)).toEqual(["a", "b"]);
  });
});

describe("money typed by a person", () => {
  it("reads it as cents", () => {
    expect(toMinor("1,250.50")).toBe(125050);
    expect(toMinor("$1250")).toBe(125000);
    expect(toMinor("0.1")).toBe(10);
    expect(toMinor("")).toBe(0);
    expect(toMinor("abc")).toBe(0);
  });
});
