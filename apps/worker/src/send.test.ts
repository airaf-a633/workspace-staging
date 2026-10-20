import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processEraseMedia, processSendMessage, type Ctx } from "./handlers";

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
      if (fn === "outbound_outlook") return { data: [{ mailbox: "support@n.example", graph_id: "AAMk-1" }], error: null };
      if (fn === "mail_connection")
        return { data: [{ channel_id: "ch1", workspace_id: "w1", provider: overrides.gmail ? "gmail" : "outlook", mailbox: "support@n.example", refresh_token: "rt", subscription_id: null, subscription_expires: null, client_state: "cs", delta_link: "d", channel_status: "connected" }], error: null };
      if (fn === "outbound_gmail") return { data: [{ mailbox: "support@n.example", thread_id: "18f2a" }], error: null };
      if (fn === "outbound_email" && overrides.gmail)
        return { data: [{ subject: "Hello", thread_key: "<g1@x>", in_reply_to: "<g1@x>", refs: ["<g1@x>"], settings: { provider: "gmail", address: "support@n.example" }, token: "gmail:support@n.example", sender: "Leo" }], error: null };
      if (fn === "outbound_email" && overrides.outlook)
        return { data: [{ subject: "Hello", thread_key: "<o1@x>", in_reply_to: "<o1@x>", refs: ["<o1@x>"], settings: { provider: "outlook", address: "support@n.example", signature: "Northwind" }, token: "outlook:support@n.example", sender: "Leo" }], error: null };
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

  it("replies through Outlook itself for an Outlook mailbox", async () => {
    const { db } = fakeDb({ channel_type: "email", to_address: "mariam@example.com", outlook: true });
    const urls: string[] = [];
    let reply: Record<string, unknown> = {};
    const microsoft = (async (url: string, init: RequestInit) => {
      urls.push(url);
      if (url.includes("/token")) return new Response(JSON.stringify({ access_token: "at", refresh_token: "rt" }), { status: 200 });
      reply = JSON.parse(String(init.body));
      return new Response(null, { status: 202 });
    }) as unknown as typeof fetch;
    const c = { ...ctx(db, microsoft), microsoft: { clientId: "id", clientSecret: "secret" } };
    expect(await processSendMessage(c, { message_id: "m1" }, false)).toBe("sent <outlook-reply-m1>");
    expect(urls.at(-1)).toBe("https://graph.microsoft.com/v1.0/users/support%40n.example/messages/AAMk-1/reply");
    expect(String(reply.comment)).toContain("Northwind");
  });

  it("replies inside the customer's Gmail thread", async () => {
    const { db } = fakeDb({ channel_type: "email", to_address: "mariam@example.com", gmail: true });
    let sent: Record<string, unknown> = {};
    const google = (async (url: string, init: RequestInit) => {
      if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "at" }), { status: 200 });
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "gm-1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const c = { ...ctx(db, google), google: { clientId: "id", clientSecret: "secret" } };
    expect(await processSendMessage(c, { message_id: "m1" }, false)).toBe("sent <relay-m1@n.example>");
    expect(sent.threadId).toBe("18f2a");
    expect(typeof sent.raw).toBe("string");
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

describe("erasing a customer's files", () => {
  it("removes only paths inside a workspace folder", async () => {
    const removed: string[][] = [];
    const db = { storage: { from: () => ({ remove: async (p: string[]) => { removed.push(p); return { error: null }; } }) } } as unknown as SupabaseClient;
    const ws = "11111111-1111-1111-1111-111111111111";
    const r = await processEraseMedia({ db, apiVersion: "v", log: () => {} }, { paths: [`${ws}/c/m.jpg`, "../etc/passwd", `${ws}/c/n.pdf`] });
    expect(r).toBe("removed 2 files");
    expect(removed).toEqual([[`${ws}/c/m.jpg`, `${ws}/c/n.pdf`]]);
  });
});
