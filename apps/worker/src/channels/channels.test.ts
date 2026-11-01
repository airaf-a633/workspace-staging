import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processSendMessage, type Ctx } from "../handlers";
import { processChannelEvent, processChannelMedia } from "./inbound";
import { MODULES, register } from "./registry";
import { ChannelSendError, type ChannelModule } from "./types";

/** A made-up channel, so the shared code is tested without any real provider. */
const sent: unknown[] = [];
const fake: ChannelModule = {
  type: "api",
  parse: (body) => {
    const b = body as { messages?: { id: string; from: string; text?: string; file?: string }[] };
    return (b.messages ?? []).map((m) => ({
      kind: "api", address: m.from, display: "Ana", externalId: m.id, type: m.file ? "image" : "text", body: m.text ?? null,
      sentAt: new Date("2026-11-01T10:00:00Z"), data: { token: `t-${m.id}` },
      ...(m.file ? { media: [{ ref: { id: m.file }, mime: "image/png", filename: "a.png" }] } : {}),
    }));
  },
  send: async (_f, creds, req) => {
    if (req.body === "boom") throw new ChannelSendError("The service is down.", "down", true);
    if (req.body === "blocked") throw new ChannelSendError("This person blocked the bot.", "blocked");
    sent.push({ creds, req });
    return { externalId: `out-${req.messageId}` };
  },
  download: async (_f, _creds, ref) => ({ bytes: new Uint8Array([1, 2, 3]), mime: "image/png", filename: `${String(ref.id)}.png` }),
};

function fakeDb(opts: { filed?: boolean } = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const uploads: string[] = [];
  const rows: Record<string, unknown> = {
    webhook_events: { id: 1, payload: { channel_id: "ch1", body: { messages: [{ id: "m-1", from: "u1", text: "Hi" }, { id: "m-2", from: "u1", file: "f9" }] } } },
    channels: { id: "ch1", workspace_id: "w1", type: "api", settings: {}, status: "connected" },
    messages: { id: "msg1", workspace_id: "w1", conversation_id: "c1", media_id: null },
  };
  const table = (name: string) => {
    const q: Record<string, unknown> = {};
    for (const k of ["select", "eq"]) q[k] = () => q;
    q.single = async () => ({ data: rows[name], error: null });
    q.maybeSingle = async () => ({ data: rows[name], error: null });
    return q;
  };
  const db = {
    from: (name: string) => table(name),
    storage: { from: () => ({ upload: async (path: string) => { uploads.push(path); return { error: null }; }, remove: async () => ({ error: null }) }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "channel_secrets") return { data: { bot_token: "tok" }, error: null };
      if (fn === "ingest_inbound") return { data: opts.filed === false ? null : `msg-${String(args.p_external_id)}`, error: null };
      if (fn === "outbound_message")
        return { data: [{ message_id: "m1", status: "queued", body: "Hello", channel_id: "ch1", channel_type: "api", channel_status: "connected", phone_number_id: null, to_address: "u1", settings: { a: 1 }, thread_key: "", last_inbound: { token: "t" }, last_inbound_at: "2026-11-01T10:00:00Z" }], error: null };
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
  return { db, calls, uploads };
}

const ctx = (db: SupabaseClient): Ctx => ({ db, apiVersion: "v21.0", log: () => {}, fetch: (async () => new Response("{}")) as unknown as typeof fetch });

beforeEach(() => {
  sent.length = 0;
  register(fake);
});

describe("filing an inbound channel webhook", () => {
  it("files every message and queues a download for each file", async () => {
    const { db, calls } = fakeDb();
    const r = await processChannelEvent(ctx(db), 1);
    expect(r).toEqual({ outcome: "processed", note: "2 messages, 2 new" });
    const filed = calls.filter((c) => c.fn === "ingest_inbound");
    expect(filed.map((c) => c.args.p_external_id)).toEqual(["m-1", "m-2"]);
    expect(filed[0]!.args).toMatchObject({ p_channel: "ch1", p_kind: "api", p_address: "u1", p_body: "Hi", p_data: { token: "t-m-1" } });
    const queued = calls.filter((c) => c.fn === "enqueue_job");
    expect(queued).toHaveLength(1);
    expect(queued[0]!.args.p_queue).toBe("channel_media");
    expect(queued[0]!.args.p_payload).toMatchObject({ message_id: "msg-m-2", channel_id: "ch1", ref: { id: "f9" } });
  });

  it("queues nothing for a message that was already filed", async () => {
    const { db, calls } = fakeDb({ filed: false });
    expect(await processChannelEvent(ctx(db), 1)).toEqual({ outcome: "processed", note: "2 messages, 0 new" });
    expect(calls.some((c) => c.fn === "enqueue_job")).toBe(false);
  });

  it("ignores a channel type it has no handler for", async () => {
    const saved = MODULES.api!;
    delete MODULES.api;
    const { db } = fakeDb();
    expect((await processChannelEvent(ctx(db), 1)).outcome).toBe("ignored");
    register(saved);
  });
});

describe("downloading a customer file", () => {
  it("stores it privately and attaches it to the message", async () => {
    const { db, calls, uploads } = fakeDb();
    await processChannelMedia(ctx(db), { message_id: "msg1", channel_id: "ch1", ref: { id: "f9" }, mime: null, filename: null }, false);
    expect(uploads).toEqual(["w1/c1/msg1.png"]);
    expect(calls.find((c) => c.fn === "attach_media")?.args).toMatchObject({ p_message: "msg1", p_storage_path: "w1/c1/msg1.png", p_size: 3, p_error: null });
  });

  it("retries a failed download, and on the last try records why", async () => {
    MODULES.api = { ...fake, download: async () => { throw new Error("gone"); } };
    const first = fakeDb();
    await expect(processChannelMedia(ctx(first.db), { message_id: "msg1", channel_id: "ch1", ref: { id: "f9" }, mime: null, filename: null }, false)).rejects.toThrow("gone");
    const last = fakeDb();
    await processChannelMedia(ctx(last.db), { message_id: "msg1", channel_id: "ch1", ref: { id: "f9" }, mime: null, filename: null }, true);
    expect(last.calls.find((c) => c.fn === "attach_media")?.args).toMatchObject({ p_storage_path: null, p_error: "gone" });
  });
});

describe("replying through a channel module", () => {
  it("sends with the stored credentials and the customer's last message", async () => {
    const { db, calls } = fakeDb();
    expect(await processSendMessage(ctx(db), { message_id: "m1" }, false)).toBe("sent out-m1");
    expect(sent[0]).toMatchObject({ creds: { bot_token: "tok" }, req: { to: "u1", body: "Hello", settings: { a: 1 }, lastInbound: { token: "t" } } });
    expect(calls.find((c) => c.fn === "mark_message_sent")?.args).toEqual({ p_message: "m1", p_external_id: "out-m1" });
  });

  it("fails at once, in the module's own words, when the person blocked the channel", async () => {
    const { db, calls } = fakeDb();
    const blocked = { ...fake, send: async () => { throw new ChannelSendError("This person blocked the bot.", "blocked"); } };
    MODULES.api = blocked;
    await processSendMessage(ctx(db), { message_id: "m1" }, false);
    expect(calls.find((c) => c.fn === "mark_message_failed")?.args).toMatchObject({ p_code: "blocked", p_text: "This person blocked the bot." });
  });

  it("throws on a temporary failure so the queue retries, and fails on the last try", async () => {
    MODULES.api = { ...fake, send: async () => { throw new ChannelSendError("The service is down.", "down", true); } };
    const first = fakeDb();
    await expect(processSendMessage(ctx(first.db), { message_id: "m1" }, false)).rejects.toBeInstanceOf(ChannelSendError);
    expect(first.calls.some((c) => c.fn === "mark_message_failed")).toBe(false);
    const last = fakeDb();
    await processSendMessage(ctx(last.db), { message_id: "m1" }, true);
    expect(last.calls.find((c) => c.fn === "mark_message_failed")?.args).toMatchObject({ p_code: "down" });
  });
});
