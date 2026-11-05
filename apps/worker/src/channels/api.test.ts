import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import api, { parseApiMessage, signWebhook } from "./api";
import { ChannelSendError } from "./types";

describe("reading an inbound API message", () => {
  it("maps a plain text message", () => {
    const [m] = parseApiMessage({ id: "msg-1", customer: { id: "user-42", name: "Ana" }, text: "  Hello  ", sent_at: "2026-11-01T10:00:00Z", conversation: "order-9" });
    expect(m).toMatchObject({ kind: "api", address: "user-42", display: "Ana", externalId: "msg-1", type: "text", body: "Hello", threadKey: "order-9" });
    expect(m!.sentAt.toISOString()).toBe("2026-11-01T10:00:00.000Z");
  });

  it("needs a message id and a customer id", () => {
    expect(parseApiMessage({ customer: { id: "u" }, text: "hi" })).toEqual([]);
    expect(parseApiMessage({ id: "m", text: "hi" })).toEqual([]);
    expect(parseApiMessage(null)).toEqual([]);
    expect(parseApiMessage("nope")).toEqual([]);
  });

  it("accepts a numeric customer id", () => {
    expect(parseApiMessage({ id: "m", customer: { id: 42 }, text: "hi" })[0]!.address).toBe("42");
  });

  it("keeps attachments by link, typed by their kind", () => {
    const [m] = parseApiMessage({ id: "m", customer: { id: "u" }, attachments: [{ url: "https://x.example/a.png", name: "a.png", type: "image/png" }, { url: "https://x.example/b.pdf" }] });
    expect(m).toMatchObject({ type: "image", body: null });
    expect(m!.media).toHaveLength(2);
    expect(m!.media![0]).toMatchObject({ ref: { url: "https://x.example/a.png" }, mime: "image/png", filename: "a.png" });
  });

  it("skips attachments without a link and caps their number", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ url: `https://x.example/${i}` }));
    expect(parseApiMessage({ id: "m", customer: { id: "u" }, attachments: many })[0]!.media).toHaveLength(10);
    expect(parseApiMessage({ id: "m", customer: { id: "u" }, text: "hi", attachments: [{ name: "x" }] })[0]!.media).toEqual([]);
  });

  it("falls back to now when sent_at is missing or not a date", () => {
    const before = Date.now();
    const [m] = parseApiMessage({ id: "m", customer: { id: "u" }, text: "hi", sent_at: "yesterday-ish" });
    expect(m!.sentAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe("signing a webhook", () => {
  it("is the HMAC of the timestamp and body, so a receiver can verify it", () => {
    const sig = signWebhook("whsec_test", 1_700_000_000, '{"a":1}');
    const expected = createHmac("sha256", "whsec_test").update('1700000000.{"a":1}').digest("hex");
    expect(sig).toBe(`t=1700000000,v1=${expected}`);
  });
});

describe("replying to an API inbox", () => {
  const req = { messageId: "m1", body: "Hello", to: "user-42", threadKey: "order-9", settings: {}, lastInbound: null, lastInboundAt: null };

  it("says plainly when no webhook address is set", async () => {
    await expect(api.send(fetch, { webhook_secret: "s" }, req)).rejects.toMatchObject({ code: "no_webhook" });
  });

  it("refuses a webhook address inside the network, and says why", async () => {
    const err = await api.send(fetch, { webhook_secret: "s" }, { ...req, settings: { webhook_url: "https://169.254.169.254/x" } }).catch((e) => e);
    expect(err).toBeInstanceOf(ChannelSendError);
    expect(err).toMatchObject({ code: "blocked_address", temporary: false });
  });

  it("refuses a webhook address that is not https", async () => {
    await expect(api.send(fetch, { webhook_secret: "s" }, { ...req, settings: { webhook_url: "http://example.com/hook" } })).rejects.toMatchObject({ code: "blocked_address" });
  });
});
