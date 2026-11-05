import { describe, expect, it } from "vitest";
import { fresh, hmac, same, signedBy } from "./signatures";

describe("webhook signatures", () => {
  it("accepts the signature of the exact body", () => {
    const sig = hmac("sha256", "secret", '{"a":1}', "base64");
    expect(signedBy("sha256", "secret", '{"a":1}', sig, "base64")).toBe(true);
  });

  it("rejects a changed body, a wrong secret, or no signature", () => {
    const sig = hmac("sha256", "secret", '{"a":1}', "hex");
    expect(signedBy("sha256", "secret", '{"a":2}', sig, "hex")).toBe(false);
    expect(signedBy("sha256", "other", '{"a":1}', sig, "hex")).toBe(false);
    expect(signedBy("sha256", "secret", '{"a":1}', null, "hex")).toBe(false);
    expect(signedBy("sha256", "secret", '{"a":1}', "", "hex")).toBe(false);
    expect(signedBy("sha256", "", '{"a":1}', sig, "hex")).toBe(false);
  });

  it("compares strings of different lengths without throwing", () => {
    expect(same("abc", "abcd")).toBe(false);
    expect(same("abc", "abc")).toBe(true);
  });

  it("only trusts recent timestamps", () => {
    const now = Date.UTC(2026, 10, 1, 12, 0, 0);
    expect(fresh(now / 1000 - 60, now)).toBe(true);
    expect(fresh(now / 1000 - 3600, now)).toBe(false);
    expect(fresh(Number.NaN, now)).toBe(false);
  });
});
