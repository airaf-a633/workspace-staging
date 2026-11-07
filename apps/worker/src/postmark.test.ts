import { describe, expect, it } from "vitest";
import { buildEmail, classifyEmailError, PostmarkError, sendEmail, type EmailContext } from "./postmark";

const ctx: EmailContext = {
  body: "It ships today.\n\nTracking follows.",
  sender: "Leo",
  to: "mariam@example.com",
  subject: "Order 4821",
  inReplyTo: "<second@mail.example>",
  refs: ["<root@mail.example>", "<second@mail.example>"],
  settings: { address: "support@northwind.example", fromName: "Northwind Support", signature: "Northwind Home\nnorthwindhome.com", domainVerified: false },
  token: "northwind-3fa9c2",
  sendDomain: "mail.relay.test",
  messageId: "<relay-m1@mail.relay.test>",
};

describe("building an email reply", () => {
  it("comes from a Relay address, replying to the business's, until the domain is verified", () => {
    const e = buildEmail(ctx);
    expect(e.From).toBe('"Leo · Northwind Support" <northwind-3fa9c2@mail.relay.test>');
    expect(e.ReplyTo).toBe("support@northwind.example");
  });

  it("comes from the business's own address once verified", () => {
    const e = buildEmail({ ...ctx, settings: { ...ctx.settings, domainVerified: true } });
    expect(e.From).toBe('"Leo · Northwind Support" <support@northwind.example>');
    expect(e.ReplyTo).toBeUndefined();
  });

  it("keeps the thread together", () => {
    const h = Object.fromEntries(buildEmail(ctx).Headers.map((x) => [x.Name, x.Value]));
    expect(h["In-Reply-To"]).toBe("<second@mail.example>");
    expect(h.References).toBe("<root@mail.example> <second@mail.example>");
    expect(h["Message-ID"]).toBe("<relay-m1@mail.relay.test>");
  });

  it("prefixes Re: once", () => {
    expect(buildEmail(ctx).Subject).toBe("Re: Order 4821");
    expect(buildEmail({ ...ctx, subject: "RE: Order 4821" }).Subject).toBe("RE: Order 4821");
  });

  it("adds the signature after the standard separator, and escapes HTML", () => {
    const e = buildEmail({ ...ctx, body: "<b>bold</b> & co" });
    expect(e.TextBody).toBe("<b>bold</b> & co\n\n-- \nNorthwind Home\nnorthwindhome.com");
    expect(e.HtmlBody).toContain("&lt;b&gt;bold&lt;/b&gt; &amp; co");
  });

  it("can't be broken by quotes in a name", () => {
    expect(buildEmail({ ...ctx, sender: 'Leo "the boss"\r\nBcc: x' }).From.startsWith('"Leo the bossBcc: x · Northwind Support"')).toBe(true);
  });
});

describe("sending and failures", () => {
  it("returns Postmark's id", async () => {
    const fake = (async () => new Response(JSON.stringify({ ErrorCode: 0, MessageID: "pm-1" }), { status: 200 })) as unknown as typeof fetch;
    expect(await sendEmail("t", buildEmail(ctx), fake)).toEqual({ id: "pm-1" });
  });

  it("fails at once for an address that bounced, in plain words", () => {
    const r = classifyEmailError(new PostmarkError("Inactive recipient", 422, 406));
    expect(r.temporary).toBe(false);
    expect(r.reason).toMatch(/bounced/);
  });

  it("retries when Postmark is down", () => {
    expect(classifyEmailError(new PostmarkError("down", 503, -1)).temporary).toBe(true);
    expect(classifyEmailError(new TypeError("fetch failed")).temporary).toBe(true);
  });
});
