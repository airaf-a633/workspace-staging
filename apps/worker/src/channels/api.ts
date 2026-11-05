import { createHmac } from "node:crypto";
import { BlockedAddress, readLimited, safeFetch } from "./net";
import { register } from "./registry";
import { ChannelSendError, type ChannelModule, type InboundItem } from "./types";

/**
 * The API channel (decided 2026-11-01): any system can push customer messages into an inbox and receive the
 * team's replies on a webhook. Inbound arrives at /api/v1/inboxes/<key>/messages (checked by the web route);
 * outbound is a signed POST to the address in the inbox's settings.
 *
 * Inbound message:  { id, customer: { id, name? }, text?, sent_at?, conversation?, attachments?: [{ url, name?, type? }] }
 * Outbound message: { event: "message.sent", id, conversation, customer: { id }, text, sent_at }
 * Signature header: X-Relay-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>" under the signing secret>
 */

const MAX_FILE = 25 * 1024 * 1024;
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

function kindOf(mime: string | undefined): string {
  if (!mime) return "document";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

/** Reads one inbound message from a request body; anything malformed is skipped rather than guessed at. */
export function parseApiMessage(body: unknown): InboundItem[] {
  const b = (body ?? {}) as Record<string, unknown>;
  const customer = (b.customer ?? {}) as Record<string, unknown>;
  const id = text(b.id, 200);
  const customerId = text(typeof customer.id === "number" ? String(customer.id) : customer.id, 200);
  if (!id || !customerId) return [];
  const sentAt = typeof b.sent_at === "string" && !Number.isNaN(Date.parse(b.sent_at)) ? new Date(b.sent_at) : new Date();
  const files = (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 10).flatMap((a, i) => {
    const x = (a ?? {}) as Record<string, unknown>;
    const url = text(x.url, 2000);
    return url ? [{ ref: { id: `att-${i + 1}`, url }, mime: text(x.type, 100), filename: text(x.name, 200) }] : [];
  });
  const body_ = text(b.text, 4096);
  return [
    {
      kind: "api",
      address: customerId,
      display: text(customer.name, 120),
      externalId: id,
      type: body_ ? "text" : kindOf(files[0]?.mime),
      body: body_ ?? null,
      sentAt,
      threadKey: text(b.conversation, 200) ?? "",
      media: files,
    },
  ];
}

/** The signature the receiver checks. Exported so the docs, the tests and the receiver's example agree. */
export function signWebhook(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

const api: ChannelModule = {
  type: "api",
  parse: (body) => parseApiMessage(body),

  async send(_f, creds, req) {
    const url = typeof req.settings.webhook_url === "string" ? req.settings.webhook_url : "";
    if (!url) throw new ChannelSendError("This API inbox has no webhook address yet. Add one in the inbox's settings, then send again.", "no_webhook");
    const sentAt = new Date().toISOString();
    const payload = JSON.stringify({
      event: "message.sent",
      id: req.messageId,
      conversation: req.threadKey || null,
      customer: { id: req.to },
      text: req.body,
      sent_at: sentAt,
    });
    let res: Response;
    try {
      res = await safeFetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Relay-Webhook/1",
          "x-relay-signature": signWebhook(creds.webhook_secret ?? "", Math.floor(Date.now() / 1000), payload),
        },
        body: payload,
        timeoutMs: 10_000,
      });
    } catch (e) {
      if (e instanceof BlockedAddress) throw new ChannelSendError(`Relay can't send to that webhook address. ${e.message} Check it in the inbox's settings.`, "blocked_address");
      throw new ChannelSendError("Relay couldn't reach your webhook address. It will try again.", "unreachable", true);
    }
    if (res.ok) return { externalId: `api-out:${req.messageId}` };
    if (res.status === 408 || res.status === 429 || res.status >= 500) throw new ChannelSendError(`Your server answered with an error (${res.status}). It will try again.`, `http_${res.status}`, true);
    throw new ChannelSendError(`Your server refused the reply (${res.status}). Check the webhook address and that it accepts Relay's calls.`, `http_${res.status}`);
  },

  async download(_f, _creds, ref) {
    const url = typeof ref.url === "string" ? ref.url : "";
    const res = await safeFetch(url, { timeoutMs: 30_000 });
    if (!res.ok) throw new Error(`The file link answered ${res.status}.`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_FILE) throw new Error("That file is too large.");
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim();
    return { bytes: await readLimited(res, MAX_FILE), ...(mime ? { mime } : {}) };
  },
};

register(api);
export default api;
