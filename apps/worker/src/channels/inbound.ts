import { extensionFor } from "@app/whatsapp";
import type { Ctx } from "../handlers";
import { MODULES } from "./registry";
import type { ChannelRow, Creds } from "./types";

async function rpc<T>(ctx: Ctx, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await ctx.db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export async function channelCreds(ctx: Ctx, channelId: string): Promise<Creds> {
  return (await rpc<Creds | null>(ctx, "channel_secrets", { p_channel: channelId })) ?? {};
}

/**
 * Files one stored provider webhook. Safe to run twice: each message's provider id is the dedupe key, so a
 * resent webhook files nothing new. The route stored { channel_id, body }, already signature-checked.
 */
export async function processChannelEvent(ctx: Ctx, eventId: number): Promise<{ outcome: "processed" | "ignored"; note: string }> {
  const { data: event, error } = await ctx.db.from("webhook_events").select("id, payload").eq("id", eventId).single();
  if (error || !event) throw new Error(`event ${eventId} not found: ${error?.message}`);
  const { channel_id, body } = event.payload as { channel_id?: string; body?: unknown };
  if (!channel_id) return { outcome: "ignored", note: "No channel in this event" };

  const { data: channel } = await ctx.db.from("channels").select("id, workspace_id, type, settings").eq("id", channel_id).maybeSingle();
  if (!channel) return { outcome: "ignored", note: "Channel is gone" };
  const row = channel as ChannelRow;
  const module = MODULES[row.type];
  if (!module) return { outcome: "ignored", note: `No handler for ${row.type}` };

  const creds = await channelCreds(ctx, channel_id);
  const items = module.parse(body, row, creds);
  let filed = 0;
  for (const item of items) {
    const id = await rpc<string | null>(ctx, "ingest_inbound", {
      p_channel: channel_id,
      p_kind: item.kind,
      p_address: item.address,
      p_display: item.display ?? null,
      p_external_id: item.externalId,
      p_type: item.type,
      p_body: item.body ?? null,
      p_caption: item.caption ?? null,
      p_data: { ...(item.data ?? {}), ...(item.media && item.media.length > 1 ? { more_files: item.media.length - 1 } : {}) },
      p_reply_to: item.replyTo ?? null,
      p_sent_at: item.sentAt.toISOString(),
      p_thread_key: item.threadKey ?? "",
      p_subject: item.subject ?? null,
    });
    if (!id) continue; // already filed
    filed++;
    const first = item.media?.[0];
    if (first) {
      await rpc(ctx, "enqueue_job", {
        p_queue: "channel_media",
        p_payload: { message_id: id, channel_id, ref: first.ref, mime: first.mime ?? null, filename: first.filename ?? null },
      });
    }
  }
  if (module.welcome) {
    try {
      await module.welcome(ctx.fetch ?? fetch, creds, body, row);
    } catch (e) {
      ctx.log(`welcome failed for channel ${channel_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { outcome: "processed", note: `${items.length} messages, ${filed} new` };
}

/** Downloads one customer file into private storage and attaches it to its message. */
export async function processChannelMedia(
  ctx: Ctx,
  job: { message_id: string; channel_id: string; ref: Record<string, unknown>; mime: string | null; filename: string | null },
  lastAttempt: boolean,
): Promise<void> {
  const { data: msg, error } = await ctx.db.from("messages").select("id, workspace_id, conversation_id, media_id").eq("id", job.message_id).single();
  if (error || !msg) throw new Error(`message ${job.message_id} not found`);
  if (msg.media_id) return; // already attached (a retried job)
  const label = typeof job.ref.id === "string" ? job.ref.id : null;
  try {
    const { data: channel } = await ctx.db.from("channels").select("type").eq("id", job.channel_id).single();
    const module = MODULES[(channel as { type: string } | null)?.type ?? ""];
    if (!module?.download) throw new Error("this channel has no downloads");
    const file = await module.download(ctx.fetch ?? fetch, await channelCreds(ctx, job.channel_id), job.ref);
    const mime = file.mime ?? job.mime;
    const filename = file.filename ?? job.filename;
    const path = `${msg.workspace_id}/${msg.conversation_id}/${msg.id}.${extensionFor(mime ?? null, filename ?? null)}`;
    const up = await ctx.db.storage.from("media").upload(path, file.bytes, { ...(mime ? { contentType: mime } : {}), upsert: true });
    if (up.error) throw new Error(`storage: ${up.error.message}`);
    await rpc(ctx, "attach_media", {
      p_message: msg.id, p_meta_media_id: label, p_storage_path: path, p_mime: mime ?? null,
      p_size: file.bytes.byteLength, p_sha256: null, p_filename: filename ?? null, p_error: null,
    });
  } catch (e) {
    // Retried by the queue; on the last try the thread shows "Media couldn't be downloaded".
    if (!lastAttempt) throw e;
    await rpc(ctx, "attach_media", {
      p_message: msg.id, p_meta_media_id: label, p_storage_path: null, p_mime: job.mime,
      p_size: null, p_sha256: null, p_filename: job.filename, p_error: e instanceof Error ? e.message : String(e),
    });
  }
}
