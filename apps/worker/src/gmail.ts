import { trimQuoted, htmlToText, type InboundEmail } from "./email";
import type { PostmarkEmail } from "./postmark";

/**
 * Gmail through Google's API (decided 2026-10-20). Fetch-injectable, so it's tested without Google. Relay checks
 * the mailbox's history feed every minute (only messages added to the inbox since the last check), reads each
 * message, and replies by sending a standard email inside the customer's Gmail thread, so it shows in Sent.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

export const gmailRevoked = (e: unknown) => e instanceof GmailError && (e.code === "invalid_grant" || e.status === 401);
/** The starting point is too old (Gmail keeps about a week of history): start again from now. */
export const historyExpired = (e: unknown) => e instanceof GmailError && e.status === 404;

export async function refreshGoogle(clientId: string, clientSecret: string, refreshToken: string, f: typeof fetch = fetch) {
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) throw new GmailError(json.error ?? `token ${res.status}`, res.status, json.error ?? "token");
  return json.access_token;
}

async function api<T>(f: typeof fetch, access: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await f(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", ...init.headers } });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { status?: string; message?: string } };
  if (!res.ok) throw new GmailError(json.error?.message ?? `gmail ${res.status}`, res.status, json.error?.status ?? "gmail");
  return json;
}

/** The mailbox's current history id: the starting point when it's first connected. */
export async function currentHistoryId(access: string, f: typeof fetch = fetch) {
  return (await api<{ historyId: string }>(f, access, "/profile")).historyId;
}

/** Messages added to the inbox since `startHistoryId`, and the history id to start from next time. */
export async function newInboxMessages(access: string, startHistoryId: string, f: typeof fetch = fetch) {
  const ids = new Set<string>();
  let page: string | undefined;
  let latest = startHistoryId;
  for (let i = 0; i < 50; i++) {
    const q = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", labelId: "INBOX", ...(page ? { pageToken: page } : {}) });
    const r = await api<{ history?: { messagesAdded?: { message: { id: string; labelIds?: string[] } }[] }[]; historyId?: string; nextPageToken?: string }>(
      f, access, `/history?${q}`,
    );
    for (const h of r.history ?? []) for (const a of h.messagesAdded ?? []) if (!a.message.labelIds?.includes("DRAFT")) ids.add(a.message.id);
    if (r.historyId) latest = r.historyId;
    if (!r.nextPageToken) break;
    page = r.nextPageToken;
  }
  return { ids: [...ids], historyId: latest };
}

interface Part {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: Part[];
}
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: Part;
}

const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const ids = (v: string | undefined) => (v ?? "").match(/<[^<>\s]+>/g) ?? [];
const flatten = (p: Part | undefined): Part[] => (p ? [p, ...(p.parts ?? []).flatMap(flatten)] : []);
const MAX_ATTACHMENT = 10 * 1024 * 1024;

/** "Mariam Haddad <mariam@example.com>" → parts. */
export function parseAddress(v: string) {
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1]!.trim(), email: m[2]!.trim().toLowerCase() } : { name: "", email: v.trim().toLowerCase() };
}

/** One Gmail message, as the same shape every email uses. Null for mail the mailbox sent itself. */
export function toInbound(m: GmailMessage, mailbox: string, attachments: InboundEmail["attachments"]): (InboundEmail & { gmailThreadId: string }) | null {
  if (m.labelIds?.includes("SENT")) return null;
  const head = (n: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value;
  const from = parseAddress(head("From") ?? "");
  if (!from.email || from.email === mailbox.toLowerCase()) return null;
  const parts = flatten(m.payload);
  const text = parts.find((p) => p.mimeType === "text/plain" && !p.filename && p.body?.data);
  const html = parts.find((p) => p.mimeType === "text/html" && !p.filename && p.body?.data);
  const body = text ? trimQuoted(b64(text.body!.data!).toString("utf8")) : html ? htmlToText(b64(html.body!.data!).toString("utf8")) : "";
  const inReplyTo = ids(head("In-Reply-To"))[0] ?? null;
  const date = new Date(Number(m.internalDate ?? Date.now()));
  return {
    gmailThreadId: m.threadId,
    token: null,
    from: from.email,
    fromName: from.name,
    messageId: ids(head("Message-ID"))[0] ?? `<gmail-${m.id}@gmail>`,
    inReplyTo,
    refs: [...new Set([...ids(head("References")), ...(inReplyTo ? [inReplyTo] : [])])],
    subject: (head("Subject") ?? "").trim().slice(0, 300),
    body: body.slice(0, 20_000),
    cc: (head("Cc") ?? "").split(",").map((a) => parseAddress(a).email).filter((a) => a && a !== mailbox.toLowerCase()),
    sentAt: Number.isNaN(date.getTime()) ? new Date() : date,
    attachments,
  };
}

export async function readGmail(access: string, mailbox: string, id: string, f: typeof fetch = fetch) {
  const m = await api<GmailMessage>(f, access, `/messages/${encodeURIComponent(id)}?format=full`);
  const files = flatten(m.payload).filter((p) => p.filename && p.body?.attachmentId && (p.body.size ?? 0) <= MAX_ATTACHMENT);
  const attachments: InboundEmail["attachments"] = [];
  for (const p of files) {
    const a = await api<{ data: string }>(f, access, `/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(p.body!.attachmentId!)}`);
    attachments.push({ name: p.filename!.slice(0, 200), mime: p.mimeType ?? "application/octet-stream", bytes: Uint8Array.from(b64(a.data)) });
  }
  return toInbound(m, mailbox, attachments);
}

/** A header value safe for any language: RFC 2047 encoded when it isn't plain ASCII. */
const encodeWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);

/** Turns the reply we'd give Postmark into a raw MIME message for Gmail, sent from the mailbox itself. */
export function toMime(e: PostmarkEmail, mailbox: string) {
  const boundary = `relay-${Math.random().toString(36).slice(2)}`;
  const display = e.From.match(/^"([^"]*)"/)?.[1] ?? "";
  const lines = [
    `From: ${display ? `"${encodeWord(display).replace(/"/g, "")}" ` : ""}<${mailbox}>`,
    `To: ${e.To}`,
    `Subject: ${encodeWord(e.Subject)}`,
    ...e.Headers.map((h) => `${h.Name}: ${h.Value}`),
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(e.TextBody, "utf8").toString("base64"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(e.HtmlBody, "utf8").toString("base64"),
    `--${boundary}--`,
    "",
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendGmail(access: string, raw: string, threadId: string | null, f: typeof fetch = fetch) {
  const r = await api<{ id: string }>(f, access, "/messages/send", { method: "POST", body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }) });
  return r.id;
}

export function classifyGmailError(e: GmailError): { temporary: boolean; code: string; reason: string } {
  const temporary = e.status === 429 || e.status >= 500;
  if (temporary) return { temporary, code: `gmail-${e.status}`, reason: "Gmail is busy right now. Relay kept trying but couldn't send it." };
  if (e.status === 403) return { temporary, code: "gmail-403", reason: "Gmail didn't allow Relay to send from this mailbox. Reconnect it in Settings › Channels." };
  return { temporary, code: `gmail-${e.status}`, reason: "Gmail didn't accept this reply." };
}
