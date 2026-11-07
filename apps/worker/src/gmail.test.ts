import { describe, expect, it } from "vitest";
import { GmailError, gmailRevoked, historyExpired, newInboxMessages, parseAddress, refreshGoogle, toInbound, toMime } from "./gmail";
import { buildEmail } from "./postmark";

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

const message = {
  id: "m1",
  threadId: "18f2a",
  labelIds: ["INBOX", "UNREAD"],
  internalDate: String(Date.parse("2026-10-20T09:15:00Z")),
  payload: {
    mimeType: "multipart/alternative",
    headers: [
      { name: "From", value: '"Mariam Haddad" <Mariam@Example.com>' },
      { name: "Subject", value: " Re: Order 4821 " },
      { name: "Message-ID", value: "<b@mail.example>" },
      { name: "In-Reply-To", value: "<a@mail.example>" },
      { name: "References", value: "<root@mail.example> <a@mail.example>" },
      { name: "Cc", value: "support@qamar.example, Boss <boss@example.com>" },
    ],
    parts: [
      { mimeType: "text/plain", body: { data: b64url("Any news?\n\nOn Sun, Leo wrote:\n> We're on it.") } },
      { mimeType: "text/html", body: { data: b64url("<p>Any news?</p>") } },
    ],
  },
};

describe("reading Gmail", () => {
  it("keeps the new part of the email, the thread and the threading ids", () => {
    const e = toInbound(message, "support@qamar.example", [])!;
    expect(e.body).toBe("Any news?");
    expect(e.gmailThreadId).toBe("18f2a");
    expect(e.refs).toEqual(["<root@mail.example>", "<a@mail.example>"]);
    expect(e.from).toBe("mariam@example.com");
    expect(e.fromName).toBe("Mariam Haddad");
    expect(e.cc).toEqual(["boss@example.com"]);
  });

  it("ignores mail the mailbox sent", () => {
    expect(toInbound({ ...message, labelIds: ["SENT"] }, "support@qamar.example", [])).toBeNull();
  });

  it("reads plain and named addresses", () => {
    expect(parseAddress("a@b.co")).toEqual({ name: "", email: "a@b.co" });
    expect(parseAddress("Leo <Leo@B.co>")).toEqual({ name: "Leo", email: "leo@b.co" });
  });

  it("collects new inbox messages across pages and moves the starting point on", async () => {
    const pages = [
      json(200, { history: [{ messagesAdded: [{ message: { id: "1" } }, { message: { id: "2", labelIds: ["DRAFT"] } }] }], nextPageToken: "p2", historyId: "200" }),
      json(200, { history: [{ messagesAdded: [{ message: { id: "1" } }, { message: { id: "3" } }] }], historyId: "210" }),
    ];
    const f = (async () => pages.shift()!) as unknown as typeof fetch;
    expect(await newInboxMessages("access", "100", f)).toEqual({ ids: ["1", "3"], historyId: "210" });
  });
});

describe("replying through Gmail", () => {
  const reply = buildEmail({
    body: "Ça part aujourd'hui.",
    sender: "Léo",
    to: "mariam@example.com",
    subject: "Order 4821",
    inReplyTo: "<b@mail.example>",
    refs: ["<root@mail.example>", "<b@mail.example>"],
    settings: { address: "support@qamar.example", fromName: "Qamar Support", signature: "Qamar", domainVerified: true },
    token: "gmail:support@qamar.example",
    sendDomain: "mail.relay.test",
    messageId: "<relay-m1@mail.relay.test>",
  });
  const mime = Buffer.from(toMime(reply, "support@qamar.example").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

  it("sends from the mailbox itself, with the thread headers", () => {
    expect(mime).toContain("<support@qamar.example>");
    expect(mime).toContain("In-Reply-To: <b@mail.example>");
    expect(mime).toContain("References: <root@mail.example> <b@mail.example>");
    expect(mime).toContain("Subject: Re: Order 4821");
  });

  it("encodes names in any language so mail apps show them correctly", () => {
    expect(mime).toMatch(/From: "=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=" <support@qamar\.example>/);
  });

  it("carries both a text and an HTML version", () => {
    expect(mime).toContain("Content-Type: text/plain");
    expect(mime).toContain("Content-Type: text/html");
  });
});

describe("when Google says no", () => {
  it("treats a revoked sign-in as needing Reconnect", async () => {
    const f = (async () => json(400, { error: "invalid_grant" })) as unknown as typeof fetch;
    expect(gmailRevoked(await refreshGoogle("id", "secret", "rt", f).catch((x) => x))).toBe(true);
  });

  it("knows when the starting point is too old", () => {
    expect(historyExpired(new GmailError("Requested entity was not found.", 404, "NOT_FOUND"))).toBe(true);
  });
});
