import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EVENT_TYPES, getAccountInfo, parseViberBody, setWebhook, validViberSignature } from "./viber-api";

const reply = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

describe("Viber's callback signature", () => {
  const body = '{"event":"message","message_token":4912661846655238145}';
  const hex = createHmac("sha256", "tok").update(body).digest("hex");
  const b64 = createHmac("sha256", "tok").update(body).digest("base64");

  it("accepts the HMAC SHA-256 of the exact body under the token, in hex or base64", () => {
    expect(validViberSignature("tok", body, hex)).toBe(true);
    expect(validViberSignature("tok", body, hex.toUpperCase())).toBe(true);
    expect(validViberSignature("tok", body, b64)).toBe(true);
  });

  it("refuses another token, a changed body, and a missing signature", () => {
    expect(validViberSignature("other", body, hex)).toBe(false);
    expect(validViberSignature("tok", body + " ", hex)).toBe(false);
    expect(validViberSignature("tok", body, null)).toBe(false);
    expect(validViberSignature("tok", body, "")).toBe(false);
    expect(validViberSignature("", body, hex)).toBe(false);
  });
});

describe("big message tokens", () => {
  it("keeps them exact by reading them as strings", () => {
    const parsed = parseViberBody('{"event":"delivered","message_token":4912661846655238145,"user_id":"u"}') as { message_token: string };
    expect(parsed.message_token).toBe("4912661846655238145");
    expect(parseViberBody('{"message_token": 5098034272017990000}') as unknown).toEqual({ message_token: "5098034272017990000" });
  });
});

describe("checking a bot token", () => {
  it("reads the account, including the webhook it already has", async () => {
    expect(await getAccountInfo(reply({ status: 0, status_message: "ok", id: "pa:1234", name: "Acme Support", webhook: "https://old.example/x" }), "tok")).toEqual({ ok: true, value: { id: "pa:1234", name: "Acme Support", webhook: "https://old.example/x" } });
    expect(await getAccountInfo(reply({ status: 0, id: 1234, name: "A" }), "tok")).toEqual({ ok: true, value: { id: "1234", name: "A", webhook: undefined } });
  });

  it("reports Viber's refusal and an outage", async () => {
    expect(await getAccountInfo(reply({ status: 2, status_message: "invalidAuthToken" }), "bad")).toEqual({ ok: false, reason: "rejected", message: "invalidAuthToken" });
    expect(await getAccountInfo(reply({}), "x")).toEqual({ ok: false, reason: "unreachable" });
    expect(await getAccountInfo((async () => { throw new Error("offline"); }) as unknown as typeof fetch, "x")).toEqual({ ok: false, reason: "unreachable" });
  });
});

describe("setting the webhook", () => {
  it("sends the address and every event type, with the token in Viber's header", async () => {
    let seen: { url: string; token: string; body: Record<string, unknown> } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, token: (init.headers as Record<string, string>)["x-viber-auth-token"]!, body: JSON.parse(String(init.body)) }; return new Response('{"status":0,"status_message":"ok"}'); }) as unknown as typeof fetch;
    expect(await setWebhook(f, "tok", "https://relay.example/api/webhooks/viber/k")).toEqual({ ok: true, value: true });
    expect(seen!.url).toBe("https://chatapi.viber.com/pa/set_webhook");
    expect(seen!.token).toBe("tok");
    expect(seen!.body).toEqual({ url: "https://relay.example/api/webhooks/viber/k", event_types: [...EVENT_TYPES], send_name: true, send_photo: true });
    expect(EVENT_TYPES).toEqual(expect.arrayContaining(["message", "subscribed", "unsubscribed"]));
  });

  it("reports Viber's reason when it can't reach the address", async () => {
    expect(await setWebhook(reply({ status: 1, status_message: "failure" }), "tok", "https://x")).toEqual({ ok: false, reason: "rejected", message: "failure" });
  });
});
