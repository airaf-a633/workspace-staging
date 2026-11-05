import { describe, expect, it } from "vitest";
import { businessMinutes, worstClock, type ServerClock, type TeamSchedule } from "../components/sla/sla";
import { clocksByConversation, closureFromRow, noticeTarget, policyFromRow, toHhmm, toMinutes, weekFromRows, weekToJson } from "./sla-map";

describe("hours", () => {
  it("goes between minutes and HH:MM, including midnight", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("24:00")).toBe(1440);
    expect(toHhmm(0)).toBe("00:00");
    expect(toHhmm(1020)).toBe("17:00");
    expect(toHhmm(1440)).toBe("24:00");
  });

  it("builds a Monday-first week from rows, with missing days closed", () => {
    const week = weekFromRows([{ weekday: 0, opens: 540, closes: 1020 }, { weekday: 6, opens: 0, closes: 1440 }]);
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual(["09:00", "17:00"]);
    expect(week[1]).toBeNull();
    expect(week[6]).toEqual(["00:00", "24:00"]);
  });

  it("turns a week back into what the database takes", () => {
    expect(weekToJson([["09:00", "17:00"], null, null, null, null, null, ["00:00", "24:00"]])).toEqual([
      { opens: 540, closes: 1020 }, null, null, null, null, null, { opens: 0, closes: 1440 },
    ]);
  });

  it("maps closed days and special hours", () => {
    expect(closureFromRow({ id: "c1", from_date: "2026-12-25", to_date: "2026-12-26", opens: null, closes: null, label: null })).toEqual({ id: "c1", from: "2026-12-25", to: "2026-12-26", hours: null, label: "" });
    expect(closureFromRow({ id: "c2", from_date: "2026-03-11", to_date: "2026-03-11", opens: 600, closes: 720, label: "Short day" }).hours).toEqual(["10:00", "12:00"]);
  });
});

describe("rules", () => {
  it("leaves out the groups a rule does not name", () => {
    const p = policyFromRow({ id: "p", name: "Everyone", active: true, team_ids: [], channel_types: [], vip: false, first_reply_min: 60, next_reply_min: null, resolution_min: 480 });
    expect(p.match).toEqual({});
    expect(p.firstReply).toBe(60);
    expect(p.nextReply).toBeNull();
  });

  it("keeps teams, channels and VIP", () => {
    const p = policyFromRow({ id: "p", name: "VIP", active: false, team_ids: ["t1"], channel_types: ["email"], vip: true, first_reply_min: 10, next_reply_min: null, resolution_min: null });
    expect(p.match).toEqual({ teams: ["t1"], channels: ["email"], vip: true });
    expect(p.active).toBe(false);
  });
});

describe("clocks", () => {
  const rows = [
    { conversation_id: "c1", target: "first_reply", used: "26.00", limit_min: 30, state: "warn", running: true, policy: "Fast" },
    { conversation_id: "c1", target: "resolution", used: 26, limit_min: 480, state: "ok", running: true, policy: "Everyone" },
    { conversation_id: "c2", target: "weird", used: 1, limit_min: 5, state: "ok", running: true, policy: "x" },
    { conversation_id: "c2", target: "next_reply", used: 1, limit_min: 5, state: "late", running: true, policy: "x" },
  ];

  it("groups by chat, reads numbers sent as text, and skips what it does not understand", () => {
    const m = clocksByConversation(rows);
    expect(m.get("c1")).toHaveLength(2);
    expect(m.get("c1")![0]).toEqual({ target: "firstReply", used: 26, limit: 30, state: "warn", running: true, policy: "Fast" });
    expect(m.has("c2")).toBe(false);
  });

  it("shows the most urgent clock of a chat", () => {
    const c = (target: ServerClock["target"], state: ServerClock["state"], used: number, limit: number, running = true): ServerClock => ({ target, state, used, limit, running, policy: "p" });
    expect(worstClock([])).toBeNull();
    expect(worstClock([c("firstReply", "warn", 26, 30), c("resolution", "breach", 500, 480, false)])?.target).toBe("resolution");
    expect(worstClock([c("firstReply", "ok", 5, 30), c("resolution", "ok", 5, 480)])?.target).toBe("firstReply");
    expect(worstClock([c("resolution", "ok", 40, 480, false)])?.state).toBe("paused");
    expect(worstClock([c("resolution", "breach", 40, 30, false)])?.state).toBe("breach");
  });

  it("maps the target a notice names", () => {
    expect(noticeTarget("next_reply")).toBe("nextReply");
    expect(noticeTarget(null)).toBeUndefined();
    expect(noticeTarget("nope")).toBeUndefined();
  });
});

describe("business minutes in the preview", () => {
  const weekdays: TeamSchedule = { week: [["09:00", "17:00"], ["09:00", "17:00"], ["09:00", "17:00"], ["09:00", "17:00"], ["09:00", "17:00"], null, null], closures: [] };
  const at = (iso: string) => Date.parse(iso);

  it("skips the weekend (6 March 2026 is a Friday, Dubai is UTC+4)", () => {
    expect(businessMinutes(at("2026-03-06T16:00:00+04:00"), at("2026-03-09T10:00:00+04:00"), weekdays, "Asia/Dubai")).toBe(120);
  });

  it("skips a closed day and uses a day's own hours", () => {
    const s: TeamSchedule = {
      ...weekdays,
      closures: [
        { id: "a", from: "2026-03-09", to: "2026-03-09", hours: null, label: "Holiday" },
        { id: "b", from: "2026-03-11", to: "2026-03-11", hours: ["10:00", "12:00"], label: "Short day" },
      ],
    };
    expect(businessMinutes(at("2026-03-06T16:00:00+04:00"), at("2026-03-10T10:00:00+04:00"), s, "Asia/Dubai")).toBe(120);
    expect(businessMinutes(at("2026-03-11T08:00:00+04:00"), at("2026-03-11T18:00:00+04:00"), s, "Asia/Dubai")).toBe(120);
  });

  it("treats a day that closes at 24:00 as open to midnight", () => {
    const s: TeamSchedule = { week: Array.from({ length: 7 }, () => ["00:00", "24:00"] as [string, string]), closures: [] };
    expect(businessMinutes(at("2026-03-06T22:00:00+04:00"), at("2026-03-07T02:00:00+04:00"), s, "Asia/Dubai")).toBe(240);
  });
});
