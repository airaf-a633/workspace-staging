import type { InboundEmail } from "./email";

/**
 * Outlook through Microsoft Graph (decided 2026-10-20). Small, fetch-injectable calls, so they're tested without
 * Microsoft. Relay reads new mail with a delta query on the inbox (only mail from the moment of connecting; older
 * mail stays where it is), is told about new mail by a push subscription that's renewed before it expires, and
 * replies through Graph so replies land in the mailbox's Sent folder.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const TOKEN = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const SCOPES = "offline_access User.Read Mail.ReadWrite Mail.ReadWrite.Shared Mail.Send Mail.Send.Shared";
/** Microsoft allows mail subscriptions of up to 4,230 minutes; we ask for 2 days and renew with 12 hours to spare. */
export const SUBSCRIPTION_MS = 2 * 24 * 60 * 60 * 1000;

export class GraphMailError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

/** Access revoked, password changed, consent withdrawn: only a new sign-in fixes it. */
export const isRevoked = (e: unknown) => e instanceof GraphMailError && (e.code === "invalid_grant" || e.code === "interaction_required" || e.status === 401);
/** The mailbox can't be opened with this sign-in (no access to the shared mailbox, or it doesn't exist). */
export const isNoMailbox = (e: unknown) => e instanceof GraphMailError && (e.status === 403 || e.status === 404) && e.code !== "subscription";

export async function refreshAccess(clientId: string, clientSecret: string, refreshToken: string, f: typeof fetch = fetch) {
  const res = await f(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken, scope: SCOPES }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string };
  if (!res.ok || !json.access_token) throw new GraphMailError(json.error ?? `token ${res.status}`, res.status, json.error ?? "token");
  return { access: json.access_token, refresh: json.refresh_token ?? refreshToken };
}

async function graph<T>(f: typeof fetch, access: string, url: string, init: RequestInit = {}, code = "graph"): Promise<T> {
  const res = await f(url.startsWith("http") ? url : `${GRAPH}${url}`, {
    ...init,
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", Prefer: 'outlook.body-content-type="text"', ...init.headers },
  });
  if (res.status === 202 || res.status === 204) return {} as T;
  const json = (await res.json().catch(() => ({}))) as T & { error?: { code?: string; message?: string } };
  if (!res.ok) throw new GraphMailError(json.error?.message ?? `graph ${res.status}`, res.status, json.error?.code ?? code);
  return json;
}

const box = (mailbox: string) => `/users/${encodeURIComponent(mailbox)}`;

export async function createSubscription(access: string, mailbox: string, notificationUrl: string, clientState: string, now: number, f: typeof fetch = fetch) {
  const expires = new Date(now + SUBSCRIPTION_MS).toISOString();
  const s = await graph<{ id: string; expirationDateTime: string }>(f, access, "/subscriptions", {
    method: "POST",
    body: JSON.stringify({ changeType: "created", notificationUrl, resource: `${box(mailbox).slice(1)}/mailFolders('inbox')/messages`, expirationDateTime: expires, clientState }),
  }, "subscription");
  return { id: s.id, expires: s.expirationDateTime };
}

export async function renewSubscription(access: string, id: string, now: number, f: typeof fetch = fetch) {
  const expires = new Date(now + SUBSCRIPTION_MS).toISOString();
  const s = await graph<{ expirationDateTime: string }>(f, access, `/subscriptions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ expirationDateTime: expires }),
  }, "subscription");
  return { id, expires: s.expirationDateTime };
}

interface DeltaPage {
  value: { id: string; "@removed"?: unknown; isDraft?: boolean }[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

/**
 * New inbox messages since the last check. The first call starts from `since` (the moment of connecting), so
 * older mail isn't imported. Returns the ids to read and the link for next time.
 */
export async function inboxDelta(access: string, mailbox: string, deltaLink: string | null, since: Date, f: typeof fetch = fetch) {
  let url =
    deltaLink ??
    `${box(mailbox)}/mailFolders('inbox')/messages/delta?changeType=created&$select=id,isDraft&$filter=receivedDateTime+ge+${since.toISOString()}`;
  const ids: string[] = [];
  for (let page = 0; page < 50; page++) {
    const d = await graph<DeltaPage>(f, access, url);
    for (const m of d.value) if (!m["@removed"] && !m.isDraft) ids.push(m.id);
    if (d["@odata.deltaLink"]) return { ids, deltaLink: d["@odata.deltaLink"] };
    if (!d["@odata.nextLink"]) break;
    url = d["@odata.nextLink"];
  }
  return { ids, deltaLink: deltaLink ?? url };
}

interface GraphMessage {
  id: string;
  internetMessageId?: string;
  subject?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  ccRecipients?: { emailAddress?: { address?: string } }[];
  receivedDateTime?: string;
  uniqueBody?: { content?: string };
  body?: { content?: string };
  internetMessageHeaders?: { name: string; value: string }[];
  hasAttachments?: boolean;
}

const ids = (v: string | undefined) => (v ?? "").match(/<[^<>\s]+>/g) ?? [];
const MAX_ATTACHMENT = 10 * 1024 * 1024;

/** One message, as the same shape forwarded emails use. Null for mail the mailbox sent itself. */
export async function readMessage(access: string, mailbox: string, id: string, f: typeof fetch = fetch): Promise<(InboundEmail & { graphId: string }) | null> {
  const m = await graph<GraphMessage>(
    f,
    access,
    `${box(mailbox)}/messages/${encodeURIComponent(id)}?$select=id,internetMessageId,subject,from,ccRecipients,receivedDateTime,uniqueBody,body,internetMessageHeaders,hasAttachments`,
  );
  return toInbound(m, mailbox, m.hasAttachments ? await readAttachments(access, mailbox, id, f) : []);
}

export function toInbound(m: GraphMessage, mailbox: string, attachments: InboundEmail["attachments"]): (InboundEmail & { graphId: string }) | null {
  const from = (m.from?.emailAddress?.address ?? "").toLowerCase();
  if (!from || from === mailbox.toLowerCase()) return null;
  const head = (n: string) => m.internetMessageHeaders?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value;
  const inReplyTo = ids(head("In-Reply-To"))[0] ?? null;
  const refs = [...new Set([...ids(head("References")), ...(inReplyTo ? [inReplyTo] : [])])];
  const date = new Date(m.receivedDateTime ?? "");
  const text = (m.uniqueBody?.content?.trim() || m.body?.content?.trim() || "").slice(0, 20_000);
  return {
    graphId: m.id,
    token: null,
    from,
    fromName: (m.from?.emailAddress?.name ?? "").trim(),
    messageId: m.internetMessageId ?? `<graph-${m.id}@outlook>`,
    inReplyTo,
    refs,
    subject: (m.subject ?? "").trim().slice(0, 300),
    body: text,
    cc: (m.ccRecipients ?? []).map((c) => (c.emailAddress?.address ?? "").toLowerCase()).filter((a) => a && a !== mailbox.toLowerCase()),
    sentAt: Number.isNaN(date.getTime()) ? new Date() : date,
    attachments,
  };
}

async function readAttachments(access: string, mailbox: string, id: string, f: typeof fetch) {
  const r = await graph<{ value: { "@odata.type"?: string; name?: string; contentType?: string; size?: number; contentBytes?: string }[] }>(
    f,
    access,
    `${box(mailbox)}/messages/${encodeURIComponent(id)}/attachments`,
  );
  return r.value
    .filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment" && a.contentBytes && (a.size ?? 0) <= MAX_ATTACHMENT)
    .map((a) => ({ name: (a.name ?? "attachment").slice(0, 200), mime: a.contentType ?? "application/octet-stream", bytes: Uint8Array.from(Buffer.from(a.contentBytes!, "base64")) }));
}

/** Microsoft busy or down: retry. Anything else permanent, said plainly. */
export function classifyGraphError(e: GraphMailError): { temporary: boolean; code: string; reason: string } {
  const temporary = e.status === 429 || e.status >= 500;
  if (temporary) return { temporary, code: `graph-${e.status}`, reason: "Outlook is busy right now. Relay kept trying but couldn't send it." };
  if (e.status === 404) return { temporary, code: "graph-404", reason: "The customer's email was deleted from Outlook, so Relay can't reply to it there." };
  if (e.status === 403) return { temporary, code: "graph-403", reason: "This sign-in isn't allowed to send from this mailbox. Check its access in Outlook, then reconnect." };
  return { temporary, code: `graph-${e.status}`, reason: "Outlook didn't accept this reply." };
}

/** Replies through Outlook itself: threaded properly and saved in the mailbox's Sent folder. */
export async function replyInOutlook(access: string, mailbox: string, graphId: string, html: string, f: typeof fetch = fetch) {
  await graph(f, access, `${box(mailbox)}/messages/${encodeURIComponent(graphId)}/reply`, {
    method: "POST",
    body: JSON.stringify({ comment: html }),
  });
}
