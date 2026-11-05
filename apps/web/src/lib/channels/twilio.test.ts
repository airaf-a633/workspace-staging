import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { e164, formFields, getAccount, twilioSigningString, validTwilioSignature } from "./twilio";

/** The example from Twilio's own security page is the model: URL, then sorted name+value pairs, no separators. */
describe("Twilio's signature", () => {
  const url = "https://app.example.com/api/webhooks/twilio/abc";
  const params = { To: "+15550100", Body: "Hello", From: "+15551234567", MessageSid: "SM1" };
  const sign = (u: string, p: Record<string, string>) => createHmac("sha1", "authtoken").update(twilioSigningString(u, p)).digest("base64");

  it("signs the address followed by the fields sorted by name", () => {
    expect(twilioSigningString(url, params)).toBe(`${url}BodyHelloFrom+15551234567MessageSidSM1To+15550100`);
  });

  it("sorts case-sensitively, so capitals come first", () => {
    expect(twilioSigningString("u", { b: "1", A: "2", a: "3" })).toBe("uA2a3b1");
  });

  it("accepts a genuine call", () => {
    expect(validTwilioSignature("authtoken", url, params, sign(url, params))).toBe(true);
  });

  it("rejects a changed field, a changed address, another token, or no signature", () => {
    const sig = sign(url, params);
    expect(validTwilioSignature("authtoken", url, { ...params, Body: "Changed" }, sig)).toBe(false);
    expect(validTwilioSignature("authtoken", url + "/", params, sig)).toBe(false);
    expect(validTwilioSignature("other", url, params, sig)).toBe(false);
    expect(validTwilioSignature("authtoken", url, params, null)).toBe(false);
    expect(validTwilioSignature("authtoken", url, params, "")).toBe(false);
    expect(validTwilioSignature("", url, params, sig)).toBe(false);
  });

  it("reads a form body into fields, decoding the plus sign and percent codes", () => {
    expect(formFields("From=%2B15551234567&Body=Hello+there&NumMedia=0")).toEqual({ From: "+15551234567", Body: "Hello there", NumMedia: "0" });
  });

  it("checks a body that was really signed, end to end", () => {
    const raw = "Body=Hi+Ana&From=%2B15551234567&MessageSid=SM9&To=%2B15550100";
    const fields = formFields(raw);
    expect(validTwilioSignature("authtoken", url, fields, sign(url, fields))).toBe(true);
  });
});

describe("checking a Twilio account", () => {
  const answer = (status: number, body: unknown) => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const f = (async (u: string | URL, init?: RequestInit) => {
      calls.push({ url: String(u), headers: (init?.headers ?? {}) as Record<string, string> });
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
    return { f, calls };
  };
  const sid = "AC" + "a".repeat(32);

  it("returns the account when Twilio confirms the same SID", async () => {
    const { f, calls } = answer(200, { sid, friendly_name: "Acme" });
    expect(await getAccount(f, sid, "tok")).toEqual({ ok: true, value: { sid, name: "Acme" } });
    expect(calls[0]!.url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`);
    expect(calls[0]!.headers.authorization).toBe(`Basic ${Buffer.from(`${sid}:tok`).toString("base64")}`);
    expect(calls[0]!.url).not.toContain("tok");
  });

  it("says rejected for wrong credentials, with Twilio's reason", async () => {
    expect(await getAccount(answer(401, { code: 20003, message: "Authenticate" }).f, sid, "bad")).toEqual({ ok: false, reason: "rejected", description: "Authenticate" });
  });

  it("does not accept an answer about a different account", async () => {
    expect((await getAccount(answer(200, { sid: "AC" + "b".repeat(32) }).f, sid, "tok")).ok).toBe(false);
  });

  it("says unreachable when Twilio can't be reached", async () => {
    const down = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect(await getAccount(down, sid, "tok")).toEqual({ ok: false, reason: "unreachable" });
  });
});

describe("phone numbers", () => {
  it("normalises to + and digits", () => {
    expect(e164("+1 (555) 010-0100")).toBe("+15550100100");
    expect(e164("44 7700 900123")).toBe("+447700900123");
  });
  it("refuses what can't be a number", () => {
    expect(e164("12345")).toBeNull();
    expect(e164("1".repeat(16))).toBeNull();
    expect(e164("call me")).toBeNull();
  });
});
