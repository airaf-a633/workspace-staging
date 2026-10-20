import type { SupabaseClient } from "@supabase/supabase-js";
import { parseInbound, type InboundEmail } from "./email";
import { classifyGmailError, currentHistoryId, GmailError, gmailRevoked, historyExpired, newInboxMessages, readGmail, refreshGoogle, sendGmail, toMime } from "./gmail";
import { classifyGraphError, createSubscription, GraphMailError, inboxDelta, isNoMailbox, isRevoked, readMessage, refreshAccess, renewSubscription, replyInOutlook } from "./outlook";
import { buildEmail, classifyEmailError, sendEmail } from "./postmark";
import { classifySendError, downloadMedia, extensionFor, parseMessagesValue, routeChanges, sendText, webhookEnvelope, type RoutedChange } from "@app/whatsapp";

/**
 * M2.3: what the worker does with each stored webhook. Every step is safe to run twice (Meta resends,
 * and failed jobs retry): messages dedupe on their external id, statuses only move forward, media attaches once.
 */

export interface Ctx {
  db: SupabaseClient;
  apiVersion: string;
  /** Where email forwarding addresses live (email channel); unset until email is configured. */
  inboundDomain?: string | undefined;
  /** Email sending (Postmark); unset until email is configured. */
  postmarkToken?: string | undefined;
  sendDomain?: string | undefined;
  /** Outlook (Microsoft Graph); unset until configured. */
  microsoft?: { clientId: string; clientSecret: string } | undefined;
  /** Gmail (Google API); unset until configured. */
  google?: { clientId: string; clientSecret: string } | undefined;
  /** The app's public address, for Microsoft's push notifications. */
  appUrl?: string | undefined;
  /** "Now", swappable in tests. */
  now?: () => number;
  log: (msg: string) => void;
  /** Swappable in tests; the real fetch otherwise. */
  fetch?: typeof fetch;
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

interface Outbound {
  message_id: string;
  status: string;
  body: string | null;
  channel_id: string;
  channel_type: string;
  channel_status: string;
  phone_number_id: string | null;
  to_address: string | null;
}

/** One adapter per channel type. WhatsApp first; email and website chat plug in here later. */
type Adapter = (ctx: Ctx, m: Outbound) => Promise<{ externalId: string }>;

/** A channel that can't send on this server yet: fails the message at once with the reason. */
class NotConfigured extends Error {}

/**
 * Outlook replies go out as Outlook's own reply to the customer's latest email: Microsoft threads it, quotes the
 * history and files it in the mailbox's Sent folder. A revoked sign-in fails the reply and marks the channel broken.
 */
async function sendViaOutlook(ctx: Ctx, m: Outbound, settings: Record<string, unknown>): Promise<{ externalId: string }> {
  if (!ctx.microsoft) throw new NotConfigured("Outlook isn't set up on this Relay server yet.");
  const { data, error } = await ctx.db.rpc("outbound_outlook", { p_message: m.message_id });
  if (error) throw new Error(`outbound_outlook: ${error.message}`);
  const target = (data as { mailbox: string; graph_id: string | null }[] | null)?.[0];
  if (!target?.graph_id) throw new NotConfigured("There's no email from the customer in Outlook to reply to.");
  const c = await connection(ctx, m.channel_id);
  if (!c) throw new NotConfigured("This Outlook mailbox is no longer connected.");
  const token = await access(ctx, c);
  if (!token) throw new NotConfigured("Relay lost access to this Outlook mailbox. Reconnect it in Settings › Channels, then send again.");
  const signature = typeof settings.signature === "string" ? settings.signature.trim() : "";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    (m.body ?? "").trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("") +
    (signature ? `<p style="color:#56616A">${esc(signature).replace(/\n/g, "<br>")}</p>` : "");
  await replyInOutlook(token, target.mailbox, target.graph_id, html, ctx.fetch);
  return { externalId: `<outlook-reply-${m.message_id}>` };
}
const ADAPTERS: Record<string, Adapter> = {
  // Email goes out through Postmark. Our own Message-ID is stored, so the customer's reply threads back to it.
  email: async (ctx, m) => {
    const { data, error } = await ctx.db.rpc("outbound_email", { p_message: m.message_id });
    if (error) throw new Error(`outbound_email: ${error.message}`);
    const e = (data as { subject: string | null; thread_key: string; in_reply_to: string | null; refs: string[]; settings: Record<string, unknown>; token: string; sender: string | null }[] | null)?.[0];
    if (!e) throw new NotConfigured("This email thread couldn't be found.");
    if (e.settings.provider === "outlook") return sendViaOutlook(ctx, m, e.settings);
    if (e.settings.provider === "gmail") {
      if (!ctx.google) throw new NotConfigured("Gmail isn't set up on this Relay server yet.");
      const c = await connection(ctx, m.channel_id);
      if (!c) throw new NotConfigured("This Gmail mailbox is no longer connected.");
      const token = await access(ctx, c);
      if (!token) throw new NotConfigured("Relay lost access to this Gmail mailbox. Reconnect it in Settings › Channels, then send again.");
      const { data: g } = await ctx.db.rpc("outbound_gmail", { p_message: m.message_id });
      const thread = (g as { thread_id: string | null }[] | null)?.[0]?.thread_id ?? null;
      const messageId = `<relay-${m.message_id}@${c.mailbox.split("@")[1]}>`;
      const email = buildEmail({
        body: m.body ?? "", sender: e.sender, to: m.to_address!, subject: e.subject, inReplyTo: e.in_reply_to,
        refs: e.refs?.length ? e.refs : [e.thread_key].filter(Boolean), settings: e.settings as Parameters<typeof buildEmail>[0]["settings"],
        token: e.token, sendDomain: c.mailbox.split("@")[1]!, messageId,
      });
      await sendGmail(token, toMime(email, c.mailbox), thread, ctx.fetch);
      return { externalId: messageId };
    }
    if (!ctx.postmarkToken || !ctx.sendDomain) throw new NotConfigured("Email sending isn't set up on this Relay server yet.");
    const messageId = `<relay-${m.message_id}@${ctx.sendDomain}>`;
    await sendEmail(
      ctx.postmarkToken,
      buildEmail({
        body: m.body ?? "",
        sender: e.sender,
        to: m.to_address!,
        subject: e.subject,
        inReplyTo: e.in_reply_to,
        refs: e.refs?.length ? e.refs : [e.thread_key].filter(Boolean),
        settings: e.settings as Parameters<typeof buildEmail>[0]["settings"],
        token: e.token,
        sendDomain: ctx.sendDomain,
        messageId,
      }),
      ctx.fetch,
    );
    return { externalId: messageId };
  },
  // Website chat has nothing to call: the visitor's widget fetches the reply. Marking it sent makes it visible there.
  webchat: async (_ctx, m) => ({ externalId: `wc-out:${m.message_id}` }),
  whatsapp: async (ctx, m) => {
    const token = await rpc<string | null>(ctx, "whatsapp_token", { p_account: m.channel_id });
    if (!token) throw new Error("no token for this number");
    return sendText(ctx.apiVersion, m.phone_number_id!, token, m.to_address!, m.body ?? "", ctx.fetch);
  },
};

/**
 * M2.4: sends one queued reply. Safe to run twice: only a queued message is sent, and only a queued message is
 * marked. Temporary failures throw so the queue retries; permanent ones (and the last try) fail the message
 * with a reason in plain words, shown under it in the inbox.
 */
export async function processSendMessage(ctx: Ctx, job: { message_id: string }, lastAttempt: boolean): Promise<string> {
  const { data, error } = await ctx.db.rpc("outbound_message", { p_message: job.message_id });
  if (error) throw new Error(`outbound_message: ${error.message}`);
  const m = (data as Outbound[] | null)?.[0];
  if (!m) return "message gone";
  if (m.status !== "queued") return `already ${m.status}`;

  const fail = (code: string, reason: string) => rpc(ctx, "mark_message_failed", { p_message: m.message_id, p_code: code, p_text: reason });
  const adapter = ADAPTERS[m.channel_type];
  if (!adapter) {
    await fail("unsupported", "Sending on this channel isn't available yet.");
    return `unsupported channel ${m.channel_type}`;
  }
  if (m.channel_status === "disconnected") {
    await fail("disconnected", "This channel is disconnected. Reconnect it in Settings › Channels, then send again.");
    return "channel disconnected";
  }
  if (!m.to_address) {
    await fail("no_address", "Relay doesn't have an address for this customer on this channel.");
    return "no address";
  }

  try {
    const sent = await adapter(ctx, m);
    await rpc(ctx, "mark_message_sent", { p_message: m.message_id, p_external_id: sent.externalId });
    return `sent ${sent.externalId}`;
  } catch (e) {
    const c =
      e instanceof NotConfigured ? { temporary: false, code: "not_configured", reason: e.message }
      : e instanceof GraphMailError ? classifyGraphError(e)
      : e instanceof GmailError ? classifyGmailError(e)
      : m.channel_type === "email" ? classifyEmailError(e)
      : classifySendError(e);
    if (c.temporary && !lastAttempt) throw e;
    await fail(c.code, c.reason);
    return `failed ${c.code}`;
  }
}

/**
 * Email, receiving: files one stored Postmark email into the right conversation. Safe to run twice (the email's
 * Message-ID is the dedupe key). Attachments go to the private media bucket; the first is the message's media.
 */
export async function processPostmarkEvent(ctx: Ctx, eventId: number): Promise<Outcome> {
  if (!ctx.inboundDomain) throw new Error("INBOUND_EMAIL_DOMAIN is not set");
  const { data: event, error } = await ctx.db.from("webhook_events").select("id, payload").eq("id", eventId).single();
  if (error || !event) throw new Error(`event ${eventId} not found: ${error?.message}`);
  const mail = parseInbound(event.payload, ctx.inboundDomain);
  if (!mail) return { outcome: "ignored", note: "Not a Postmark inbound email" };
  if (!mail.token) return { outcome: "ignored", note: "Not addressed to a forwarding address" };
  if (!mail.messageId) return { outcome: "ignored", note: "No Message-ID" };

  const channel = await rpc<string | null>(ctx, "email_channel_by_token", { p_token: mail.token });
  if (!channel) {
    ctx.log(`SECURITY: email for unknown forwarding token ${mail.token}`);
    return { outcome: "ignored", note: `unknown token ${mail.token}` };
  }
  const filed = await fileEmail(ctx, channel, mail, {});
  if (!filed) return { outcome: "processed", note: "repeat email" };
  return { outcome: "processed", note: `email from ${mail.from}, ${mail.attachments.length} attachments` };
}

/**
 * Files one email (forwarded or from Outlook) into its conversation: threads by References, stores attachments.
 * Returns the message id, or null when it was already filed (its Message-ID is the dedupe key).
 */
async function fileEmail(ctx: Ctx, channel: string, mail: InboundEmail, extra: Record<string, unknown>): Promise<string | null> {
  const thread = (mail.refs.length ? await rpc<string | null>(ctx, "email_thread_for", { p_channel: channel, p_refs: mail.refs }) : null) ?? mail.messageId;
  const id = await rpc<string | null>(ctx, "ingest_inbound", {
    p_channel: channel,
    p_kind: "email",
    p_address: mail.from,
    p_display: mail.fromName || null,
    p_external_id: mail.messageId,
    p_type: "text",
    p_body: mail.body,
    p_caption: null,
    p_data: { subject: mail.subject, cc: mail.cc, ...extra },
    p_reply_to: mail.inReplyTo,
    p_sent_at: mail.sentAt.toISOString(),
    p_thread_key: thread,
    p_subject: mail.subject || null,
  });
  if (!id) return null;

  const { data: msg } = await ctx.db.from("messages").select("workspace_id, conversation_id").eq("id", id).single();
  for (const [i, a] of mail.attachments.entries()) {
    const path = `${msg!.workspace_id}/${msg!.conversation_id}/${id}-${i}.${extensionFor(a.mime, a.name)}`;
    const up = await ctx.db.storage.from("media").upload(path, a.bytes, { contentType: a.mime, upsert: true });
    if (up.error) throw new Error(`storage: ${up.error.message}`);
    if (i === 0) {
      await rpc(ctx, "attach_media", { p_message: id, p_meta_media_id: null, p_storage_path: path, p_mime: a.mime, p_size: a.bytes.byteLength, p_sha256: null, p_filename: a.name, p_error: null });
    } else {
      await rpc(ctx, "add_message_attachment", { p_message: id, p_path: path, p_name: a.name, p_mime: a.mime, p_size: a.bytes.byteLength });
    }
  }
  return id;
}

// ---------------------------------------------------------------------------
// Outlook (decided 2026-10-20)
// ---------------------------------------------------------------------------

interface MailConnection {
  channel_id: string;
  workspace_id: string;
  provider: string;
  mailbox: string;
  refresh_token: string;
  subscription_id: string | null;
  subscription_expires: string | null;
  client_state: string;
  delta_link: string | null;
  channel_status: string;
}

async function connection(ctx: Ctx, channel: string) {
  const { data, error } = await ctx.db.rpc("mail_connection", { p_channel: channel });
  if (error) throw new Error(`mail_connection: ${error.message}`);
  return (data as MailConnection[] | null)?.[0] ?? null;
}

/** A fresh access token; Microsoft's rotated refresh token is saved. A revoked sign-in marks the channel broken. */
async function access(ctx: Ctx, c: MailConnection): Promise<string | null> {
  if (c.provider === "gmail") {
    if (!ctx.google) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
    try {
      return await refreshGoogle(ctx.google.clientId, ctx.google.clientSecret, c.refresh_token, ctx.fetch);
    } catch (e) {
      if (!gmailRevoked(e)) throw e;
      await rpc(ctx, "mark_mail_broken", { p_channel: c.channel_id, p_problem: "Google no longer lets Relay read this mailbox (often after a password change or removing access). Reconnect it." });
      return null;
    }
  }
  if (!ctx.microsoft) throw new Error("MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET are not set");
  try {
    const t = await refreshAccess(ctx.microsoft.clientId, ctx.microsoft.clientSecret, c.refresh_token, ctx.fetch);
    if (t.refresh !== c.refresh_token) await rpc(ctx, "save_mail_refresh_token", { p_channel: c.channel_id, p_token: t.refresh });
    return t.access;
  } catch (e) {
    if (!isRevoked(e)) throw e;
    await rpc(ctx, "mark_mail_broken", { p_channel: c.channel_id, p_problem: "Microsoft no longer lets Relay read this mailbox (often after a password change). Reconnect it." });
    return null;
  }
}

async function noMailbox(ctx: Ctx, c: MailConnection) {
  await rpc(ctx, "mark_mail_broken", { p_channel: c.channel_id, p_problem: `Relay can't open ${c.mailbox} with this sign-in. Check you have access to it in Outlook, then reconnect.` });
}

/** Starts or renews Microsoft's push subscription for the mailbox, and sets the starting point for reading mail. */
export async function processMailSubscribe(ctx: Ctx, channel: string): Promise<string> {
  const c = await connection(ctx, channel);
  if (!c) return "no mail connection";
  if (c.provider === "gmail") {
    const token = await access(ctx, c);
    if (!token) return "sign-in revoked";
    // Start from now: mail already in the mailbox stays there.
    await rpc(ctx, "set_mail_delta", { p_channel: channel, p_delta: await currentHistoryId(token, ctx.fetch) });
    return "gmail starting point set";
  }
  if (!ctx.appUrl) throw new Error("APP_URL is not set");
  const token = await access(ctx, c);
  if (!token) return "sign-in revoked";
  const now = (ctx.now ?? Date.now)();
  try {
    let sub;
    try {
      sub = c.subscription_id ? await renewSubscription(token, c.subscription_id, now, ctx.fetch) : null;
    } catch {
      sub = null; // expired or deleted on Microsoft's side: make a new one
    }
    sub ??= await createSubscription(token, c.mailbox, `${ctx.appUrl.replace(/\/$/, "")}/api/webhooks/microsoft`, c.client_state, now, ctx.fetch);
    await rpc(ctx, "set_mail_subscription", { p_channel: channel, p_subscription: sub.id, p_expires: sub.expires });
    if (!c.delta_link) {
      // Start from now: mail already in the mailbox stays there.
      const first = await inboxDelta(token, c.mailbox, null, new Date(now), ctx.fetch);
      await rpc(ctx, "set_mail_delta", { p_channel: channel, p_delta: first.deltaLink });
    }
    return `subscribed until ${sub.expires}`;
  } catch (e) {
    if (!isNoMailbox(e)) throw e;
    await noMailbox(ctx, c);
    return "mailbox not accessible";
  }
}

/** Reads new mail since the last check and files it. Safe to run any number of times. */
export async function processMailSync(ctx: Ctx, channel: string): Promise<string> {
  const c = await connection(ctx, channel);
  if (!c || c.channel_status !== "connected") return "not connected";
  if (!c.delta_link) return "not subscribed yet";
  const token = await access(ctx, c);
  if (!token) return "sign-in revoked";
  if (c.provider === "gmail") {
    try {
      const { ids, historyId } = await newInboxMessages(token, c.delta_link, ctx.fetch);
      let filed = 0;
      for (const id of ids) {
        const mail = await readGmail(token, c.mailbox, id, ctx.fetch);
        if (mail && (await fileEmail(ctx, channel, mail, { gmailThreadId: mail.gmailThreadId }))) filed++;
      }
      await rpc(ctx, "set_mail_delta", { p_channel: channel, p_delta: historyId });
      return `${filed} new of ${ids.length}`;
    } catch (e) {
      if (!historyExpired(e)) throw e;
      // Gmail only keeps about a week of history: start again from now (the worker was off for days).
      ctx.log(`gmail ${channel}: history expired, starting again from now`);
      await rpc(ctx, "set_mail_delta", { p_channel: channel, p_delta: await currentHistoryId(token, ctx.fetch) });
      return "history expired; restarted";
    }
  }
  try {
    const { ids, deltaLink } = await inboxDelta(token, c.mailbox, c.delta_link, new Date(), ctx.fetch);
    let filed = 0;
    for (const id of ids) {
      const mail = await readMessage(token, c.mailbox, id, ctx.fetch);
      if (mail && (await fileEmail(ctx, channel, mail, { graphId: mail.graphId }))) filed++;
    }
    await rpc(ctx, "set_mail_delta", { p_channel: channel, p_delta: deltaLink });
    return `${filed} new of ${ids.length}`;
  } catch (e) {
    if (!isNoMailbox(e)) throw e;
    await noMailbox(ctx, c);
    return "mailbox not accessible";
  }
}

/** Every minute: renew subscriptions before they lapse, and check mailboxes nobody has heard from in a while. */
export async function scheduleMail(ctx: Ctx): Promise<number> {
  const { data, error } = await ctx.db.rpc("mail_connections_due");
  if (error) throw new Error(`mail_connections_due: ${error.message}`);
  const due = (data ?? []) as { channel_id: string; renew: boolean }[];
  for (const d of due) {
    await rpc(ctx, "enqueue_job", { p_queue: d.renew ? "mail_subscribe" : "mail_sync", p_payload: { channel_id: d.channel_id } });
  }
  return due.length;
}

/**
 * Erasing a customer (step 2c): removes their stored files from the private bucket. The database has already
 * removed every reference to them; this only frees the storage. Safe to run twice.
 */
export async function processEraseMedia(ctx: Ctx, job: { paths: string[] }): Promise<string> {
  const paths = (job.paths ?? []).filter((p) => typeof p === "string" && /^[0-9a-f-]{36}\//.test(p));
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await ctx.db.storage.from("media").remove(paths.slice(i, i + 100));
    if (error) throw new Error(`storage remove: ${error.message}`);
  }
  return `removed ${paths.length} files`;
}
