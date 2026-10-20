/**
 * Email, sending (decided 2026-10-19). buildEmail turns a reply into the exact email Postmark sends: pure, so it's
 * tested without sending anything. sendEmail posts it; classifyEmailError says whether to retry and, if not, why in
 * plain words.
 */

export interface EmailContext {
  /** The reply as typed. */
  body: string;
  /** The person replying, shown before the channel's name: "Leo · Northwind Support". */
  sender: string | null;
  to: string;
  subject: string | null;
  inReplyTo: string | null;
  /** The thread's ids, oldest first (the first is the thread's root). */
  refs: string[];
  settings: { address?: string; fromName?: string | null; signature?: string | null; domainVerified?: boolean };
  /** The channel's forwarding token, used for the Relay sending address until the business's domain is verified. */
  token: string;
  /** Relay's own verified sending domain, e.g. mail.relayinbox.com. */
  sendDomain: string;
  /** Our id for this reply, so a retry can be recognised. */
  messageId: string;
}

export interface PostmarkEmail {
  From: string;
  To: string;
  ReplyTo?: string;
  Subject: string;
  TextBody: string;
  HtmlBody: string;
  Headers: { Name: string; Value: string }[];
  MessageStream: "outbound";
}

/** A display name that can't break the From header. */
const quote = (name: string) => `"${name.replace(/["\\\r\n]/g, "").slice(0, 120)}"`;
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildEmail(c: EmailContext): PostmarkEmail {
  const business = c.settings.fromName?.trim() || c.settings.address || "Support";
  const display = c.sender ? `${c.sender} · ${business}` : business;
  const verified = !!c.settings.domainVerified && !!c.settings.address;
  const fromAddress = verified ? c.settings.address! : `${c.token}@${c.sendDomain}`;
  const subject = c.subject?.trim() ? (/^re:/i.test(c.subject.trim()) ? c.subject.trim() : `Re: ${c.subject.trim()}`) : `Message from ${business}`;
  const signature = c.settings.signature?.trim();
  const text = signature ? `${c.body.trim()}\n\n-- \n${signature}` : c.body.trim();
  const paragraphs = (s: string) => s.split(/\n{2,}/).map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`).join("");
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111518">${paragraphs(c.body.trim())}` +
    (signature ? `<p style="color:#56616A;margin-top:24px">${escape(signature).replace(/\n/g, "<br>")}</p>` : "") +
    `</div>`;

  const headers = [{ Name: "Message-ID", Value: c.messageId }];
  if (c.inReplyTo) headers.push({ Name: "In-Reply-To", Value: c.inReplyTo });
  if (c.refs.length) headers.push({ Name: "References", Value: c.refs.join(" ") });

  return {
    From: `${quote(display)} <${fromAddress}>`,
    To: c.to,
    // Until the domain is verified, the customer's reply still goes to the business's own address (and so back to Relay).
    ...(verified || !c.settings.address ? {} : { ReplyTo: c.settings.address }),
    Subject: subject.slice(0, 300),
    TextBody: text,
    HtmlBody: html,
    Headers: headers,
    MessageStream: "outbound",
  };
}

export class PostmarkError extends Error {
  constructor(message: string, readonly status: number, readonly code: number) {
    super(message);
  }
}

export async function sendEmail(token: string, email: PostmarkEmail, fetchImpl: typeof fetch = fetch): Promise<{ id: string }> {
  const res = await fetchImpl("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": token },
    body: JSON.stringify(email),
  });
  const json = (await res.json().catch(() => ({}))) as { MessageID?: string; ErrorCode?: number; Message?: string };
  if (!res.ok || (json.ErrorCode ?? 0) !== 0) throw new PostmarkError(json.Message ?? `Postmark ${res.status}`, res.status, json.ErrorCode ?? -1);
  return { id: json.MessageID ?? "" };
}

/** Postmark error codes that mean "this will never work" get a reason; everything else is retried. */
const REASONS: Record<number, string> = {
  300: "The customer's email address isn't valid.",
  406: "This customer's address bounced before or marked an email as spam, so email providers won't accept more from you.",
  400: "The sending address isn't set up in Postmark yet. Finish the email setup, then send again.",
  401: "The sending address isn't confirmed in Postmark yet. Finish the email setup, then send again.",
  10: "Relay's email service rejected its own key. Whoever runs Relay needs to check the Postmark token.",
  412: "Relay's email account is still waiting for Postmark's approval to send to customers.",
};

export function classifyEmailError(e: unknown): { temporary: boolean; code: string; reason: string } {
  if (e instanceof PostmarkError) {
    const reason = REASONS[e.code];
    const temporary = !reason && (e.status >= 500 || e.status === 429 || e.code === -1);
    return { temporary, code: `postmark-${e.code}`, reason: reason ?? (temporary ? "The email service is busy. Relay kept trying but couldn't send it." : "The email service didn't accept this reply.") };
  }
  return { temporary: true, code: "network", reason: "Relay couldn't reach the email service." };
}
