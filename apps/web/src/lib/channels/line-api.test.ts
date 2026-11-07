import { describe, expect, it } from "vitest";
import { getBotInfo } from "./line-api";

const answer = (status: number, body: unknown) => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
};

describe("checking a LINE access token", () => {
  it("returns the account's id and name, sending the token in a header", async () => {
    const { f, calls } = answer(200, { userId: "U" + "a".repeat(32), displayName: "Acme Support", basicId: "@acme" });
    expect(await getBotInfo(f, "tok123")).toEqual({ ok: true, value: { userId: "U" + "a".repeat(32), name: "Acme Support" } });
    expect(calls[0]!.url).toBe("https://api.line.me/v2/bot/info");
    expect(calls[0]!.headers.authorization).toBe("Bearer tok123");
    expect(calls[0]!.url).not.toContain("tok123");
  });

  it("says rejected for a token LINE refuses, with LINE's reason", async () => {
    expect(await getBotInfo(answer(401, { message: "Authentication failed" }).f, "bad")).toEqual({ ok: false, reason: "rejected", description: "Authentication failed" });
  });

  it("does not guess which account it is when LINE doesn't say", async () => {
    expect(await getBotInfo(answer(200, { displayName: "X" }).f, "t")).toEqual({ ok: false, reason: "unknown_account" });
  });

  it("falls back to a plain name when LINE gives no display name", async () => {
    const r = await getBotInfo(answer(200, { userId: "Uabc" }).f, "t");
    expect(r).toEqual({ ok: true, value: { userId: "Uabc", name: "LINE" } });
  });

  it("says unreachable when LINE can't be reached", async () => {
    const down = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect(await getBotInfo(down, "t")).toEqual({ ok: false, reason: "unreachable" });
  });
});
