import { describe, expect, it } from "vitest";
import { htmlToText, parseInbound, trimQuoted } from "./email";

const base = {
  FromFull: { Email: "Mariam@Example.com", Name: "Mariam Haddad" },
  ToFull: [{ Email: "support@northwind.example", Name: "" }],
  OriginalRecipient: "northwind-3fa9c2@in.relay.test",
  Subject: "  Re: Order 4821 ",
  Date: "Mon, 20 Oct 2026 09:15:00 +0000",
  TextBody: "Any news?\n\nOn Sun, 19 Oct 2026, Leo wrote:\n> We're on it.",
  StrippedTextReply: "",
  Headers: [
    { Name: "Message-ID", Value: "<b@mail.example>" },
    { Name: "In-Reply-To", Value: "<a@mail.example>" },
    { Name: "References", Value: "<root@mail.example> <a@mail.example>" },
  ],
};

describe("receiving an email", () => {
  it("finds the forwarding token from the address Postmark delivered to", () => {
    expect(parseInbound(base, "in.relay.test")!.token).toBe("northwind-3fa9c2");
  });

  it("keeps the sender in lower case and the subject trimmed", () => {
    const e = parseInbound(base, "in.relay.test")!;
    expect(e.from).toBe("mariam@example.com");
    expect(e.fromName).toBe("Mariam Haddad");
    expect(e.subject).toBe("Re: Order 4821");
  });

  it("collects every id the email refers to, for threading", () => {
    const e = parseInbound(base, "in.relay.test")!;
    expect(e.messageId).toBe("<b@mail.example>");
    expect(e.refs).toEqual(["<root@mail.example>", "<a@mail.example>"]);
  });

  it("keeps only the new reply, not the quoted history", () => {
    expect(parseInbound(base, "in.relay.test")!.body).toBe("Any news?");
    expect(parseInbound({ ...base, StrippedTextReply: "Thanks!" }, "in.relay.test")!.body).toBe("Thanks!");
  });

  it("falls back to the HTML when there is no text part", () => {
    expect(parseInbound({ ...base, TextBody: "", HtmlBody: "<p>Hello <b>there</b></p><p>Two</p>" }, "in.relay.test")!.body).toBe("Hello there\nTwo");
  });

  it("has no token when the email didn't come through our domain", () => {
    expect(parseInbound({ ...base, OriginalRecipient: "" }, "in.relay.test")!.token).toBeNull();
  });

  it("decodes attachments and skips oversized ones", () => {
    const e = parseInbound(
      { ...base, Attachments: [{ Name: "a.txt", Content: Buffer.from("hi").toString("base64"), ContentType: "text/plain", ContentLength: 2 }, { Name: "huge.zip", Content: "", ContentType: "application/zip", ContentLength: 50_000_000 }] },
      "in.relay.test",
    )!;
    expect(e.attachments.map((a) => a.name)).toEqual(["a.txt"]);
    expect(new TextDecoder().decode(e.attachments[0]!.bytes)).toBe("hi");
  });

  it("rejects payloads that aren't Postmark inbound emails", () => {
    expect(parseInbound({ hello: "world" }, "in.relay.test")).toBeNull();
  });
});

describe("trimming helpers", () => {
  it("cuts at a quoted line", () => expect(trimQuoted("Yes\n> earlier")).toBe("Yes"));
  it("strips scripts and tags from HTML", () => expect(htmlToText("<style>x</style>Hi&nbsp;<i>you</i>")).toBe("Hi you"));
});
