import { z } from "zod";

/**
 * Email, receiving (decided 2026-10-19): Postmark's inbound webhook JSON → what Relay stores. Pure, so it's tested
 * without a database. Postmark already separates the new reply from the quoted history (StrippedTextReply); when
 * it can't, we keep the full text and trim the classic "On … wrote:" tail ourselves.
 */

const header = z.object({ Name: z.string(), Value: z.string() });
const address = z.object({ Email: z.string(), Name: z.string().optional().default("") });
export const postmarkInbound = z.object({
  FromFull: address,
  ToFull: z.array(address).default([]),
  CcFull: z.array(address).default([]),
  OriginalRecipient: z.string().optional().default(""),
  Subject: z.string().optional().default(""),
  MessageID: z.string().optional().default(""),
  Date: z.string().optional().default(""),
  TextBody: z.string().optional().default(""),
  HtmlBody: z.string().optional().default(""),
  StrippedTextReply: z.string().optional().default(""),
  Headers: z.array(header).default([]),
  Attachments: z
    .array(z.object({ Name: z.string(), Content: z.string(), ContentType: z.string(), ContentLength: z.number().optional() }))
    .default([]),
});
export type PostmarkInbound = z.infer<typeof postmarkInbound>;

export interface InboundEmail {
  /** The forwarding token ("northwind-3fa9c2") from the address the mail was delivered to. */
  token: string | null;
  from: string;
  fromName: string;
  /** The email's own Message-ID, with angle brackets: the dedupe key. */
  messageId: string;
  inReplyTo: string | null;
  /** Every id this email refers to, newest last: References then In-Reply-To. */
  refs: string[];
  subject: string;
  body: string;
  cc: string[];
  sentAt: Date;
  attachments: { name: string; mime: string; bytes: Uint8Array }[];
}

const ids = (value: string | undefined) => (value ?? "").match(/<[^<>\s]+>/g) ?? [];
const MAX_BODY = 20_000;
const MAX_ATTACHMENT = 10 * 1024 * 1024;

/** Cuts the quoted history from a plain-text reply: "On Mon, 3 Oct, Sara wrote:" and everything after. */
export function trimQuoted(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex((l, i) => /^On .{4,200}wrote:\s*$/.test(l.trim()) || (/^-{2,}\s*Original Message\s*-{2,}$/i.test(l.trim()) && i > 0) || /^>/.test(l));
  return (cut > 0 ? lines.slice(0, cut) : lines).join("\n").trim();
}

/** Plain text from HTML when an email has no text part. Good enough for the inbox; the HTML itself isn't shown. */
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseInbound(raw: unknown, inboundDomain: string): InboundEmail | null {
  const parsed = postmarkInbound.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const head = (name: string) => p.Headers.find((h) => h.Name.toLowerCase() === name.toLowerCase())?.Value;
  const domain = inboundDomain.toLowerCase();

  // A forwarded mail is addressed to the business; the address Postmark delivered to is OriginalRecipient.
  const candidates = [p.OriginalRecipient, ...p.ToFull.map((a) => a.Email), ...p.CcFull.map((a) => a.Email)].map((a) => a.toLowerCase());
  const ours = candidates.find((a) => a.endsWith(`@${domain}`));
  const token = ours ? ours.split("@")[0]!.split("+")[0]! : null;

  const messageId = ids(head("Message-ID"))[0] ?? (p.MessageID ? `<${p.MessageID}@postmark.inbound>` : "");
  const inReplyTo = ids(head("In-Reply-To"))[0] ?? null;
  const refs = [...new Set([...ids(head("References")), ...(inReplyTo ? [inReplyTo] : [])])];
  const text = p.StrippedTextReply.trim() || trimQuoted(p.TextBody) || htmlToText(p.HtmlBody);
  const date = new Date(p.Date);

  return {
    token,
    from: p.FromFull.Email.toLowerCase(),
    fromName: p.FromFull.Name.trim(),
    messageId,
    inReplyTo,
    refs,
    subject: p.Subject.trim().slice(0, 300),
    body: text.slice(0, MAX_BODY),
    cc: p.CcFull.map((a) => a.Email.toLowerCase()).filter((a) => !a.endsWith(`@${domain}`)),
    sentAt: Number.isNaN(date.getTime()) ? new Date() : date,
    attachments: p.Attachments.filter((a) => (a.ContentLength ?? 0) <= MAX_ATTACHMENT).map((a) => ({
      name: a.Name.slice(0, 200),
      mime: a.ContentType,
      bytes: Uint8Array.from(Buffer.from(a.Content, "base64")),
    })),
  };
}
