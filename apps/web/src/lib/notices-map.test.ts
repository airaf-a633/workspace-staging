import { describe, expect, it } from "vitest";
import { toNotices, type NoticeRow } from "./notices-map";

const row = (over: Partial<NoticeRow>): NoticeRow => ({
  id: "n1", kind: "handover", subject: "Lina", quote: null, percent: null,
  conversation_id: null, deal_id: null, task_id: null, channel_id: null,
  created_at: "2026-11-04T10:00:00Z", read_at: null, actor: null, ...over,
});

describe("stored notices to bell items", () => {
  it("links a chat notice to that chat and keeps the quote and who did it", () => {
    const [n] = toNotices([row({ conversation_id: "c1", quote: "Grey sofa", actor: { display_name: "Sara" } })], "/w/qamar");
    expect(n).toMatchObject({ kind: "handover", actor: "Sara", quote: "Grey sofa", href: "/w/qamar/inbox?c=c1", read: false });
  });
  it("accepts the person as a one-item list, which is how the API can return it", () => {
    const [n] = toNotices([row({ actor: [{ display_name: "Omar" }] })], "/w/qamar");
    expect(n?.actor).toBe("Omar");
  });
  it("maps every stored kind to a bell kind", () => {
    const kinds = ["handover", "mention", "collab_request", "channel_broken", "discount_asked", "discount_approved", "discount_declined", "task_assigned", "task_late", "sla_warn", "sla_breach"];
    expect(toNotices(kinds.map((k, i) => row({ id: `n${i}`, kind: k })), "/w/q").map((n) => n.kind)).toEqual([
      "handover", "mention", "collabRequest", "channelBroken", "discountAsked", "discountApproved", "discountDeclined", "taskAssigned", "taskLate", "slaWarn", "slaBreach",
    ]);
  });
  it("sends discounts to the deal (with the percent), tasks to the list and channels to the channels page", () => {
    const [d, t, c] = toNotices([
      row({ kind: "discount_asked", deal_id: "d1", percent: "10.00" }),
      row({ id: "n2", kind: "task_late", task_id: "t1" }),
      row({ id: "n3", kind: "channel_broken", channel_id: "ch1" }),
    ], "/w/q");
    expect(d).toMatchObject({ href: "/w/q/deals?deal=d1", percent: 10 });
    expect(t?.href).toBe("/w/q/tasks");
    expect(c?.href).toBe("/w/q/channels");
  });
  it("carries which reply target a notice is about, and leads to the chat", () => {
    const [w, b] = toNotices([
      row({ kind: "sla_warn", conversation_id: "c1", sla_target: "first_reply" }),
      row({ id: "n2", kind: "sla_breach", conversation_id: "c1", sla_target: "resolution" }),
    ], "/w/q");
    expect(w).toMatchObject({ kind: "slaWarn", target: "firstReply", href: "/w/q/inbox?c=c1" });
    expect(b).toMatchObject({ kind: "slaBreach", target: "resolution" });
  });
  it("marks read ones read and skips kinds it doesn't know", () => {
    const out = toNotices([row({ read_at: "2026-11-04T11:00:00Z" }), row({ id: "n2", kind: "from_the_future" })], "/w/q");
    expect(out).toHaveLength(1);
    expect(out[0]?.read).toBe(true);
  });
});
