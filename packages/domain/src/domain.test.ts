import { describe, expect, it } from "vitest";
import {
  addFils,
  availableActions,
  businessDate,
  canApply,
  fils,
  formatAed,
  InvalidTransitionError,
  multiplyFils,
  nextStatus,
  parseAed,
  toWaId,
} from "./index";

describe("money", () => {
  it("parses AED strings to integer fils", () => {
    expect(parseAed("12")).toBe(1200);
    expect(parseAed("12.5")).toBe(1250);
    expect(parseAed("1,250.75")).toBe(125075);
  });

  it("rejects invalid amounts", () => {
    expect(() => parseAed("12.345")).toThrow(RangeError);
    expect(() => parseAed("abc")).toThrow(RangeError);
    expect(() => fils(1.5)).toThrow(RangeError);
  });

  it("adds and multiplies without float drift", () => {
    expect(addFils(fils(10), fils(20))).toBe(30); // 0.10 + 0.20 AED
    expect(multiplyFils(fils(333), 3)).toBe(999);
  });

  it("formats with Latin digits", () => {
    expect(formatAed(fils(125075))).toBe("1,250.75");
  });
});

describe("businessDate", () => {
  it("uses Dubai time, not UTC", () => {
    // 20:30 UTC on 1 Oct is 00:30 on 2 Oct in Dubai (UTC+4)
    expect(businessDate(new Date("2026-10-01T20:30:00Z"))).toBe("2026-10-02");
    expect(businessDate(new Date("2026-10-01T19:59:00Z"))).toBe("2026-10-01");
  });
});

describe("phone", () => {
  it("normalises UAE formats to wa_id", () => {
    expect(toWaId("050 123 4567")).toBe("971501234567");
    expect(toWaId("+971 50 123 4567")).toBe("971501234567");
    expect(toWaId("00971501234567")).toBe("971501234567");
    expect(toWaId("501234567")).toBe("971501234567");
  });

  it("keeps international numbers", () => {
    expect(toWaId("+92 300 1234567")).toBe("923001234567");
  });

  it("rejects garbage", () => {
    expect(() => toWaId("123")).toThrow(RangeError);
  });
});

describe("order state machine", () => {
  it("follows the happy path", () => {
    let s = nextStatus("draft", "confirm");
    s = nextStatus(s, "assign");
    s = nextStatus(s, "pick_up");
    s = nextStatus(s, "deliver");
    expect(s).toBe("delivered");
  });

  it("allows retry after failure", () => {
    expect(nextStatus("failed", "retry")).toBe("assigned");
  });

  it("blocks invalid transitions", () => {
    expect(canApply("draft", "deliver")).toBe(false);
    expect(() => nextStatus("delivered", "cancel")).toThrow(InvalidTransitionError);
  });

  it("lists actions per status", () => {
    expect(availableActions("assigned").sort()).toEqual(["assign", "cancel", "fail", "pick_up"]);
    expect(availableActions("delivered")).toEqual([]);
  });
});
