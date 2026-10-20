import { describe, expect, it } from "vitest";
import { GraphError, classifySendError, sendText } from "./index";

const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("sending a text", () => {
  it("posts the WhatsApp message shape and returns the wamid", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await sendText("v21.0", "123", "secret-token", "971501234567", "Hello", fake);
    expect(r.externalId).toBe("wamid.OUT");
    expect(seen!.url).toBe("https://graph.facebook.com/v21.0/123/messages");
    expect(JSON.parse(String(seen!.init.body))).toMatchObject({ messaging_product: "whatsapp", to: "971501234567", type: "text", text: { body: "Hello" } });
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });

  it("turns a Graph error into a GraphError with Meta's code", async () => {
    await expect(sendText("v21.0", "123", "t", "1", "x", reply(400, { error: { message: "Re-engagement", code: 131047 } }))).rejects.toMatchObject({ code: 131047, status: 400 });
  });
});

describe("what to do when sending fails", () => {
  it("fails at once, in plain words, outside the 24-hour window", () => {
    const r = classifySendError(new GraphError("Re-engagement", 400, 131047));
    expect(r.temporary).toBe(false);
    expect(r.reason).toMatch(/24 hours/);
  });

  it("retries rate limits and Meta outages", () => {
    expect(classifySendError(new GraphError("Too many", 400, 130429)).temporary).toBe(true);
    expect(classifySendError(new GraphError("Down", 503, null)).temporary).toBe(true);
  });

  it("retries network errors", () => {
    expect(classifySendError(new TypeError("fetch failed")).temporary).toBe(true);
  });

  it("asks to reconnect when the token expired", () => {
    expect(classifySendError(new GraphError("expired", 401, 190)).reason).toMatch(/Reconnect/);
  });
});
