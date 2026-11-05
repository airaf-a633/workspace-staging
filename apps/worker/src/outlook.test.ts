import { describe, expect, it } from "vitest";
import { GraphMailError, inboxDelta, isNoMailbox, isRevoked, refreshAccess, toInbound } from "./outlook";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("reading Outlook mail", () => {
  const message = {
    id: "AAMk1",
    internetMessageId: "<b@mail.example>",
    subject: " Re: Order 4821 ",
    from: { emailAddress: { address: "Mariam@Example.com", name: "Mariam" } },
    ccRecipients: [{ emailAddress: { address: "support@northwind.example" } }, { emailAddress: { address: "boss@example.com" } }],
    receivedDateTime: "2026-10-20T09:15:00Z",
    uniqueBody: { content: "Any news?" },
    body: { content: "Any news?\n\nOn Sun, Leo wrote:\n> We're on it." },
    internetMessageHeaders: [
      { name: "In-Reply-To", value: "<a@mail.example>" },
      { name: "References", value: "<root@mail.example> <a@mail.example>" },
    ],
  };

  it("keeps only the new part of the email and the threading ids", () => {
    const e = toInbound(message, "support@northwind.example", [])!;
    expect(e.body).toBe("Any news?");
    expect(e.refs).toEqual(["<root@mail.example>", "<a@mail.example>"]);
    expect(e.from).toBe("mariam@example.com");
    expect(e.subject).toBe("Re: Order 4821");
    expect(e.graphId).toBe("AAMk1");
  });

  it("leaves the mailbox itself out of the copy list", () => {
    expect(toInbound(message, "support@northwind.example", [])!.cc).toEqual(["boss@example.com"]);
  });

  it("ignores mail the mailbox sent itself", () => {
    expect(toInbound({ ...message, from: { emailAddress: { address: "Support@Northwind.example" } } }, "support@northwind.example", [])).toBeNull();
  });

  it("collects new message ids across pages and returns the next delta link", async () => {
    const pages = [
      json(200, { value: [{ id: "1" }, { id: "2", isDraft: true }], "@odata.nextLink": "https://graph.microsoft.com/next" }),
      json(200, { value: [{ id: "3" }, { id: "4", "@removed": { reason: "deleted" } }], "@odata.deltaLink": "https://graph.microsoft.com/delta?token=x" }),
    ];
    const urls: string[] = [];
    const f = (async (url: string) => {
      urls.push(url);
      return pages.shift()!;
    }) as unknown as typeof fetch;
    const r = await inboxDelta("access", "support@northwind.example", null, new Date("2026-10-20T00:00:00Z"), f);
    expect(r).toEqual({ ids: ["1", "3"], deltaLink: "https://graph.microsoft.com/delta?token=x" });
    expect(urls[0]).toContain("receivedDateTime+ge+2026-10-20T00:00:00.000Z");
  });
});

describe("when Microsoft says no", () => {
  it("treats a revoked sign-in as needing Reconnect", async () => {
    const f = (async () => json(400, { error: "invalid_grant" })) as unknown as typeof fetch;
    const e = await refreshAccess("id", "secret", "rt", f).catch((x) => x);
    expect(isRevoked(e)).toBe(true);
  });

  it("recognises a mailbox this sign-in can't open", () => {
    expect(isNoMailbox(new GraphMailError("Access is denied", 403, "ErrorAccessDenied"))).toBe(true);
    expect(isNoMailbox(new GraphMailError("Throttled", 429, "TooManyRequests"))).toBe(false);
  });
});
