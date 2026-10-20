import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processSendMessage, type Ctx } from "./handlers";

/** A stand-in database: one queued WhatsApp reply, and a record of every function the worker calls. */
function fakeDb(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const row = {
    message_id: "m1", status: "queued", body: "Hello", channel_id: "ch1", channel_type: "whatsapp",
    channel_status: "connected", phone_number_id: "123", to_address: "971501234567", ...overrides,
  };
  const db = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "outbound_message") return { data: [row], error: null };
      if (fn === "whatsapp_token") return { data: "token", error: null };
      if (fn === "outbound_email")
        return { data: [{ subject: "Order 4821", thread_key: "<root@x>", in_reply_to: "<root@x>", refs: ["<root@x>"], settings: { address: "support@n.example", fromName: "Northwind" }, token: "northwind-abc123", sender: "Leo" }], error: null };
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

const graph = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const ctx = (db: SupabaseClient, f: typeof fetch): Ctx => ({ db, apiVersion: "v21.0", log: () => {}, fetch: f });

describe("sending a queued reply", () => {
  it("sends it and records WhatsApp's id", async () => {
    const { db, calls } = fakeDb();
    expect(await processSendMessage(ctx(db, graph(200, { messages: [{ id: "wamid.X" }] })), { message_id: "m1" }, false)).toBe("sent wamid.X");
    expect(calls.find((c) => c.fn === "mark_message_sent")?.args).toEqual({ p_message: "m1", p_external_id: "wamid.X" });
  });

  it("fails at once, in plain words, when the 24-hour window has closed", async () => {
    const { db, calls } = fakeDb();
    await processSendMessage(ctx(db, graph(400, { error: { message: "Re-engagement", code: 131047 } })), { message_id: "m1" }, false);
    const failed = calls.find((c) => c.fn === "mark_message_failed")!;
    expect(failed.args.p_code).toBe("131047");
    expect(String(failed.args.p_text)).toMatch(/24 hours/);
  });

  it("throws on a rate limit so the queue retries, then fails on the last try", async () => {
    const limited = graph(400, { error: { message: "Too many", code: 130429 } });
    const first = fakeDb();
    await expect(processSendMessage(ctx(first.db, limited), { message_id: "m1" }, false)).rejects.toBeTruthy();
    expect(first.calls.some((c) => c.fn === "mark_message_failed")).toBe(false);
    const last = fakeDb();
    await processSendMessage(ctx(last.db, limited), { message_id: "m1" }, true);
    expect(last.calls.some((c) => c.fn === "mark_message_failed")).toBe(true);
  });

  it("never sends a message twice", async () => {
    const { db, calls } = fakeDb({ status: "sent" });
    expect(await processSendMessage(ctx(db, graph(200, {})), { message_id: "m1" }, false)).toBe("already sent");
    expect(calls.map((c) => c.fn)).toEqual(["outbound_message"]);
  });

  it("hands website chat replies to the widget", async () => {
    const { db, calls } = fakeDb({ channel_type: "webchat", phone_number_id: null, to_address: "a".repeat(64) });
    expect(await processSendMessage(ctx(db, graph(500, {})), { message_id: "m1" }, false)).toBe("sent wc-out:m1");
    expect(calls.some((c) => c.fn === "mark_message_sent")).toBe(true);
  });

  it("sends an email reply through Postmark and stores our Message-ID for threading", async () => {
    const { db, calls } = fakeDb({ channel_type: "email", to_address: "mariam@example.com" });
    let sent: Record<string, unknown> = {};
    const postmark = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ ErrorCode: 0, MessageID: "pm-1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const c = { ...ctx(db, postmark), postmarkToken: "pm-token", sendDomain: "mail.relay.test" };
    expect(await processSendMessage(c, { message_id: "m1" }, false)).toBe("sent <relay-m1@mail.relay.test>");
    expect(sent.To).toBe("mariam@example.com");
    expect(sent.Subject).toBe("Re: Order 4821");
    expect(calls.find((x) => x.fn === "mark_message_sent")?.args.p_external_id).toBe("<relay-m1@mail.relay.test>");
  });

  it("explains when email isn't set up on this server", async () => {
    const { db, calls } = fakeDb({ channel_type: "email", to_address: "mariam@example.com" });
    await processSendMessage(ctx(db, graph(200, {})), { message_id: "m1" }, false);
    expect(String(calls.find((c) => c.fn === "mark_message_failed")!.args.p_text)).toMatch(/isn't set up/);
  });

  it("explains channels that can't send yet", async () => {
    const { db, calls } = fakeDb({ channel_type: "telegram" });
    await processSendMessage(ctx(db, graph(200, {})), { message_id: "m1" }, false);
    expect(String(calls.find((c) => c.fn === "mark_message_failed")!.args.p_text)).toMatch(/isn't available yet/);
  });
});
