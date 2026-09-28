import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { routeChanges, signBody, verifySignature, verifySubscription, webhookEnvelope } from "./index";

const raw = readFileSync(new URL("./fixtures/text-message.json", import.meta.url), "utf8");
const secret = "test-app-secret";

describe("signature", () => {
  it("accepts Meta's signature over the raw body", () => {
    expect(verifySignature(raw, signBody(raw, secret), secret)).toBe(true);
  });

  it("rejects a tampered body, a wrong secret, and malformed headers", () => {
    expect(verifySignature(raw + " ", signBody(raw, secret), secret)).toBe(false);
    expect(verifySignature(raw, signBody(raw, "other"), secret)).toBe(false);
    expect(verifySignature(raw, "sha256=zz", secret)).toBe(false);
    expect(verifySignature(raw, null, secret)).toBe(false);
    expect(verifySignature(raw, signBody(raw, secret), "")).toBe(false);
  });
});

describe("subscription handshake", () => {
  it("echoes the challenge only for the right token", () => {
    const ok = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "t0k", "hub.challenge": "42" });
    expect(verifySubscription(ok, "t0k")).toBe("42");
    expect(verifySubscription(ok, "nope")).toBeNull();
    expect(verifySubscription(ok, "")).toBeNull();
  });
});

describe("envelope routing", () => {
  it("routes a message change to its phone number", () => {
    const routed = routeChanges(webhookEnvelope.parse(JSON.parse(raw)));
    expect(routed).toHaveLength(1);
    expect(routed[0]).toMatchObject({ field: "messages", known: true, phoneNumberId: "106540352242922", wabaId: "102290129340398" });
  });

  it("keeps unknown fields instead of dropping them", () => {
    const env = webhookEnvelope.parse({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "brand_new_field", value: {} }] }] });
    expect(routeChanges(env)[0]).toMatchObject({ known: false, phoneNumberId: null });
  });

  it("rejects payloads that aren't WhatsApp Business Account webhooks", () => {
    expect(webhookEnvelope.safeParse({ object: "page", entry: [] }).success).toBe(false);
  });
});
