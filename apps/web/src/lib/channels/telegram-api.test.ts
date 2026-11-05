import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getMe, getWebhookInfo, newSecretToken, removeWebhook, setWebhook } from "./telegram-api";

function fake(status: number, body: unknown) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const down = (async () => {
  throw new TypeError("fetch failed");
}) as unknown as typeof fetch;

describe("checking a bot token", () => {
  it("returns whose bot it is", async () => {
    const { f, calls } = fake(200, { ok: true, result: { id: 777, is_bot: true, first_name: "Support", username: "acme_support_bot" } });
    expect(await getMe(f, "777:ABC")).toEqual({ ok: true, value: { id: 777, username: "acme_support_bot", name: "Support" } });
    expect(calls[0]!.url).toBe("https://api.telegram.org/bot777:ABC/getMe");
  });

  it("says rejected for a token Telegram refuses", async () => {
    expect(await getMe(fake(401, { ok: false, error_code: 401, description: "Unauthorized" }).f, "bad")).toEqual({ ok: false, reason: "rejected", description: "Unauthorized" });
  });

  it("does not accept an answer that is not a bot", async () => {
    expect((await getMe(fake(200, { ok: true, result: { id: 5, is_bot: false, first_name: "Human" } }).f, "t")).ok).toBe(false);
    expect((await getMe(fake(200, { ok: true, result: {} }).f, "t")).ok).toBe(false);
  });

  it("says unreachable when Telegram can't be reached, without the token", async () => {
    const r = await getMe(down, "777:ABC");
    expect(r).toEqual({ ok: false, reason: "unreachable" });
    expect(JSON.stringify(r)).not.toContain("777");
  });
});

describe("pointing the bot at Relay", () => {
  it("asks only for private-chat messages and sends the secret", async () => {
    const { f, calls } = fake(200, { ok: true, result: true });
    expect((await setWebhook(f, "777:ABC", "https://app.example.com/api/webhooks/telegram/abc", "sec_ret-1")).ok).toBe(true);
    expect(calls[0]!.url).toBe("https://api.telegram.org/bot777:ABC/setWebhook");
    expect(calls[0]!.body).toEqual({ url: "https://app.example.com/api/webhooks/telegram/abc", secret_token: "sec_ret-1", allowed_updates: ["message"], drop_pending_updates: false });
  });

  it("passes on Telegram's reason when it refuses the address", async () => {
    const r = await setWebhook(fake(400, { ok: false, description: "Bad Request: bad webhook: HTTPS url must be provided" }).f, "t", "http://x", "s");
    expect(r).toEqual({ ok: false, reason: "rejected", description: "Bad Request: bad webhook: HTTPS url must be provided" });
  });

  it("removes the webhook with an empty address", async () => {
    const { f, calls } = fake(200, { ok: true, result: true });
    expect((await removeWebhook(f, "t")).ok).toBe(true);
    expect(calls[0]!.body).toEqual({ url: "" });
  });
});

describe("the webhook's health", () => {
  it("reads the address, the queue and the last error", async () => {
    const { f } = fake(200, { ok: true, result: { url: "https://a/b", pending_update_count: 3, last_error_date: 1_793_000_000, last_error_message: "Connection timed out" } });
    const r = await getWebhookInfo(f, "t");
    expect(r).toMatchObject({ ok: true, value: { url: "https://a/b", pending: 3, lastError: "Connection timed out" } });
    expect(r.ok && r.value.lastErrorAt?.getTime()).toBe(1_793_000_000_000);
  });

  it("treats missing fields as no error and nothing waiting", async () => {
    expect(await getWebhookInfo(fake(200, { ok: true, result: { url: "" } }).f, "t")).toEqual({ ok: true, value: { url: "", pending: 0, lastError: null, lastErrorAt: null } });
  });
});

describe("the secret token", () => {
  it("only uses the characters Telegram allows, within its length limits", () => {
    for (let i = 0; i < 50; i++) {
      const s = newSecretToken(randomBytes);
      expect(s).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
    }
  });
});
