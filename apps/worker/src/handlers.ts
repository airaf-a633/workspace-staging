import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadMedia, extensionFor, parseMessagesValue, routeChanges, webhookEnvelope, type RoutedChange } from "@app/whatsapp";

/**
 * M2.3: what the worker does with each stored webhook. Every step is safe to run twice (Meta resends,
 * and failed jobs retry): messages dedupe on their external id, statuses only move forward, media attaches once.
 */

export interface Ctx {
  db: SupabaseClient;
  apiVersion: string;
  log: (msg: string) => void;
}

type Outcome = { outcome: "processed" | "ignored"; note: string };

async function rpc<T>(ctx: Ctx, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await ctx.db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

async function accountFor(ctx: Ctx, phoneNumberId: string | null) {
  if (!phoneNumberId) return null;
  const { data, error } = await ctx.db.from("whatsapp_accounts").select("id, workspace_id").eq("phone_number_id", phoneNumberId).maybeSingle();
  if (error) throw new Error(`account lookup: ${error.message}`);
  return data as { id: string; workspace_id: string } | null;
}

async function handleMessages(ctx: Ctx, change: RoutedChange): Promise<string> {
  const account = await accountFor(ctx, change.phoneNumberId);
  if (!account) {
    // A number not linked to any workspace: stored (webhook_events keeps it), never shown. Security log.
    ctx.log(`SECURITY: message for unlinked number ${change.phoneNumberId} (WABA ${change.wabaId})`);
    return `unlinked number ${change.phoneNumberId}`;
  }
  const { messages, statuses } = parseMessagesValue(change.value);
  let stored = 0, dup = 0, reactions = 0, media = 0;

  for (const m of messages) {
    if (m.reaction) {
      // A reaction to a message we don't have yet (out of order) is retried by the job; after that it is dropped.
      if (await rpc<boolean>(ctx, "apply_reaction", { p_channel: account.id, p_target: m.reaction.to, p_emoji: m.reaction.emoji })) reactions++;
      continue;
    }
    // A WhatsApp number's channel shares its id.
    const id = await rpc<string | null>(ctx, "ingest_inbound", {
      p_channel: account.id,
      p_kind: "whatsapp",
      p_address: m.from,
      p_display: m.profileName,
      p_external_id: m.wamid,
      p_type: m.type,
      p_body: m.body,
      p_caption: m.caption,
      p_data: m.data,
      p_reply_to: m.replyTo,
      p_sent_at: m.at.toISOString(),
    });
    if (!id) {
      dup++;
      continue;
    }
    stored++;
    if (m.media) {
      media++;
      await rpc(ctx, "enqueue_job", {
        p_queue: "media_download",
        p_payload: { message_id: id, account_id: account.id, media_id: m.media.id, filename: m.media.filename, mime: m.media.mime },
      });
    }
  }

  for (const s of statuses) {
    await rpc(ctx, "apply_message_status", {
      p_channel: account.id,
      p_external_id: s.wamid,
      p_status: s.status,
      p_error_code: s.error?.code ?? null,
      p_error_text: s.error ? [s.error.title, s.error.details].filter(Boolean).join(": ") : null,
    });
  }
  return `messages ${stored} new, ${dup} repeat, ${reactions} reactions, ${media} media; statuses ${statuses.length}`;
}

async function handleAccountChange(ctx: Ctx, change: RoutedChange): Promise<string> {
  const v = change.value as Record<string, unknown>;
  // These payloads name the number by its display number; look it up by WABA and number.
  const display = String(v.display_phone_number ?? v.phone_number ?? "").replace(/\D/g, "");
  const { data } = await ctx.db.from("whatsapp_accounts").select("phone_number_id, display_phone").eq("waba_id", change.wabaId);
  const match = (data ?? []).find((a: { display_phone: string }) => a.display_phone.replace(/\D/g, "") === display) ?? (data?.length === 1 ? data[0] : null);
  if (!match) return `${change.field} for unknown number ${display}`;
  if (change.field === "phone_number_quality_update") {
    await rpc(ctx, "update_whatsapp_account_state", { p_phone_number_id: match.phone_number_id, p_quality: v.event ?? null, p_limit: v.current_limit ?? null });
    return `quality ${String(v.event)} / ${String(v.current_limit)}`;
  }
  const event = String(v.event ?? "");
  // PARTNER_REMOVED (phone app unused 14 days, or removed), DISABLED_UPDATE, ACCOUNT_DELETED: stop sending.
  const disconnected = ["PARTNER_REMOVED", "ACCOUNT_DELETED", "DISABLED_UPDATE", "ACCOUNT_VIOLATION"].includes(event);
  if (disconnected) await rpc(ctx, "update_whatsapp_account_state", { p_phone_number_id: match.phone_number_id, p_status: "disconnected" });
  return `account_update ${event}${disconnected ? " → disconnected" : ""}`;
}

export async function processWhatsappEvent(ctx: Ctx, eventId: number): Promise<Outcome> {
  const { data: event, error } = await ctx.db.from("webhook_events").select("id, payload").eq("id", eventId).single();
  if (error || !event) throw new Error(`event ${eventId} not found: ${error?.message}`);
  const parsed = webhookEnvelope.safeParse(event.payload);
  if (!parsed.success) return { outcome: "ignored", note: "Not a WhatsApp Business Account webhook" };

  const notes: string[] = [];
  for (const change of routeChanges(parsed.data)) {
    if (change.field === "messages") notes.push(await handleMessages(ctx, change));
    else if (change.field === "account_update" || change.field === "phone_number_quality_update") notes.push(await handleAccountChange(ctx, change));
    // smb_message_echoes, history, smb_app_state_sync and templates arrive with M2.4, 2.7 and 2.8.
    else notes.push(`${change.field}: not handled yet`);
  }
  return { outcome: "processed", note: notes.join("; ") };
}

/** Downloads one media file into the private bucket at {workspace}/{conversation}/{message}.{ext}. */
export async function processMediaDownload(
  ctx: Ctx,
  job: { message_id: string; account_id: string; media_id: string; filename: string | null; mime: string | null },
  lastAttempt: boolean,
): Promise<void> {
  const { data: msg, error } = await ctx.db.from("messages").select("id, workspace_id, conversation_id, media_id").eq("id", job.message_id).single();
  if (error || !msg) throw new Error(`message ${job.message_id} not found`);
  if (msg.media_id) return; // already attached (a retried job)

  try {
    const token = await rpc<string | null>(ctx, "whatsapp_token", { p_account: job.account_id });
    if (!token) throw new Error("no token for this number");
    const file = await downloadMedia(ctx.apiVersion, job.media_id, token);
    const path = `${msg.workspace_id}/${msg.conversation_id}/${msg.id}.${extensionFor(file.mime ?? job.mime, job.filename)}`;
    const up = await ctx.db.storage.from("media").upload(path, file.bytes, { contentType: file.mime, upsert: true });
    if (up.error) throw new Error(`storage: ${up.error.message}`);
    await rpc(ctx, "attach_media", {
      p_message: msg.id, p_meta_media_id: job.media_id, p_storage_path: path, p_mime: file.mime,
      p_size: file.size ?? file.bytes.byteLength, p_sha256: file.sha256, p_filename: job.filename, p_error: null,
    });
  } catch (e) {
    // Retried by the queue; on the last try the thread shows "Media couldn't be downloaded".
    if (!lastAttempt) throw e;
    await rpc(ctx, "attach_media", {
      p_message: msg.id, p_meta_media_id: job.media_id, p_storage_path: null, p_mime: job.mime,
      p_size: null, p_sha256: null, p_filename: job.filename, p_error: e instanceof Error ? e.message : String(e),
    });
  }
}
