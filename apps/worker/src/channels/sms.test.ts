import { describe, expect, it } from "vitest";
import sms, { explainTwilioError, parseSmsMessage, smsEvents, smsStatuses } from "./sms";
import { ChannelSendError } from "./types";

const inbound = (over: Record<string, unknown> = {}) => ({ MessageSid: "SM123", AccountSid: "AC" + "a".repeat(32), From: "+1 (555) 123-4567", To: "+15550100", Body: "Hello", NumMedia: "0", ...over });

describe("reading an incoming text", () => {
  it("maps a text, addressed by the sender's number as digits", () => {
    const [m] = parseSmsMessage(inbound());
    expect(m).toMatchObject({ kind: "phone", address: "15551234567", externalId: "SM123", type: "text", body: "Hello", threadKey: "", replyTo: null });
  });

  it("falls back to SmsSid", () => {
    expect(parseSmsMessage(inbound({ MessageSid: undefined, SmsSid: "SM999" }))[0]!.externalId).toBe("SM999");
  });

  it("maps a picture message, keeping the words as its caption", () => {
    const [m] = parseSmsMessage(inbound({ Body: "My receipt", NumMedia: "1", MediaUrl0: "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1", MediaContentType0: "image/jpeg" }));
    expect(m).toMatchObject({ type: "image", body: null, caption: "My receipt" });
    expect(m!.media![0]).toMatchObject({ ref: { url: expect.stringContaining("api.twilio.com") }, mime: "image/jpeg" });
  });

  it("maps a picture with no words, and counts extra pictures", () => {
    const [m] = parseSmsMessage(inbound({ Body: "", NumMedia: "2", MediaUrl0: "https://api.twilio.com/a", MediaContentType0: "audio/mpeg", MediaUrl1: "https://api.twilio.com/b", MediaContentType1: "image/png" }));
    expect(m).toMatchObject({ type: "audio", caption: null, data: { more_files: 1 } });
  });

  it("skips an empty text, a missing sender, and a delivery callback", () => {
    expect(parseSmsMessage(inbound({ Body: "" }))).toEqual([]);
    expect(parseSmsMessage(inbound({ From: "" }))).toEqual([]);
    expect(parseSmsMessage({ ...inbound(), _relay: "status", MessageStatus: "delivered" })).toEqual([]);
    expect(parseSmsMessage(null)).toEqual([]);
  });
});

describe("STOP and START", () => {
  it("notes a STOP reported by Twilio", () => {
    expect(smsEvents(inbound({ Body: "STOP", OptOutType: "STOP" }))).toEqual([{ kind: "opted_out", identityKind: "phone", address: "15551234567" }]);
  });

  it("notes a START, but not HELP or an ordinary text", () => {
    expect(smsEvents(inbound({ OptOutType: "START" }))).toEqual([{ kind: "opted_in", identityKind: "phone", address: "15551234567" }]);
    expect(smsEvents(inbound({ OptOutType: "HELP" }))).toEqual([]);
    expect(smsEvents(inbound())).toEqual([]);
  });

  it("does not read the word STOP from the text itself: only Twilio's own report counts", () => {
    expect(smsEvents(inbound({ Body: "stop" }))).toEqual([]);
  });

  it("still files the STOP as a message, so the team sees it", () => {
    expect(parseSmsMessage(inbound({ Body: "STOP", OptOutType: "STOP" }))[0]).toMatchObject({ body: "STOP" });
  });
});

describe("delivery reports", () => {
  const status = (s: string, extra: Record<string, unknown> = {}) => ({ _relay: "status", MessageSid: "SM777", MessageStatus: s, ...extra });

  it("moves a text to sent, delivered and read", () => {
    expect(smsStatuses(status("sent"))).toEqual([{ externalId: "SM777", status: "sent" }]);
    expect(smsStatuses(status("delivered"))).toEqual([{ externalId: "SM777", status: "delivered" }]);
    expect(smsStatuses(status("read"))).toEqual([{ externalId: "SM777", status: "read" }]);
  });

  it("explains a failure, showing Twilio's code without relying on it", () => {
    expect(smsStatuses(status("undelivered", { ErrorCode: "30005" }))[0]).toMatchObject({ status: "failed", errorCode: "30005", errorText: "The text wasn't delivered (Twilio error 30005)." });
    expect(smsStatuses(status("failed"))[0]).toMatchObject({ status: "failed", errorText: "The text wasn't delivered." });
  });

  it("says plainly when the person had replied STOP", () => {
    expect(smsStatuses(status("failed", { ErrorCode: "21610" }))[0]!.errorText).toMatch(/replied STOP/);
  });

  it("ignores steps that aren't news, and anything that isn't a delivery callback", () => {
    for (const s of ["queued", "sending", "accepted"]) expect(smsStatuses(status(s))).toEqual([]);
    expect(smsStatuses({ MessageSid: "SM1", MessageStatus: "delivered" })).toEqual([]);
    expect(smsStatuses(null)).toEqual([]);
  });
});

function fakeTwilio(answers: Record<string, { status?: number; body?: unknown; bytes?: Uint8Array; headers?: Record<string, string> }>) {
  const calls: { url: string; headers: Record<string, string>; form: Record<string, string> }[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, headers: (init?.headers ?? {}) as Record<string, string>, form: init?.body ? Object.fromEntries(new URLSearchParams(String(init.body))) : {} });
    const key = Object.keys(answers).find((k) => u.includes(k));
    const a = key ? answers[key]! : { status: 404, body: {} };
    return new Response(a.bytes ?? JSON.stringify(a.body ?? {}), { status: a.status ?? 200, ...(a.headers ? { headers: a.headers } : {}) });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const creds = { account_sid: "AC" + "a".repeat(32), auth_token: "token123" };
const req = (over: Record<string, unknown> = {}) => ({
  messageId: "m1", body: "Your order shipped", to: "15551234567", threadKey: "", settings: { number: "+15550100", webhook_key: "k".repeat(32) },
  appUrl: "https://app.example.com/", lastInbound: null, lastInboundAt: null, ...over,
});

describe("replying by text", () => {
  it("posts to Twilio with the account's credentials and asks for delivery reports", async () => {
    const { f, calls } = fakeTwilio({ "/Messages.json": { status: 201, body: { sid: "SM555", status: "queued" } } });
    expect(await sms.send(f, creds, req())).toEqual({ externalId: "SM555" });
    expect(calls[0]!.url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/Messages.json`);
    expect(calls[0]!.headers.authorization).toBe(`Basic ${Buffer.from(`${creds.account_sid}:token123`).toString("base64")}`);
    expect(calls[0]!.form).toEqual({ To: "+15551234567", From: "+15550100", Body: "Your order shipped", StatusCallback: `https://app.example.com/api/webhooks/twilio/${"k".repeat(32)}/status` });
  });

  it("cuts a text at Twilio's 1,600-character limit", async () => {
    const { f, calls } = fakeTwilio({ "/Messages.json": { status: 201, body: { sid: "SM1" } } });
    await sms.send(f, creds, req({ body: "a".repeat(2000) }));
    expect(calls[0]!.form.Body).toHaveLength(1600);
  });

  it("leaves out the delivery address when Relay doesn't know its own", async () => {
    const { f, calls } = fakeTwilio({ "/Messages.json": { status: 201, body: { sid: "SM1" } } });
    await sms.send(f, creds, req({ appUrl: undefined }));
    expect(calls[0]!.form.StatusCallback).toBeUndefined();
  });

  it("says plainly when there is no sending number", async () => {
    await expect(sms.send(fakeTwilio({}).f, creds, req({ settings: {} }))).rejects.toMatchObject({ code: "no_number" });
  });

  it("explains a refusal in Twilio's words, and does not retry", async () => {
    const e = explainTwilioError(400, { code: 21211, message: "The 'To' number is not a valid phone number." });
    expect(e).toBeInstanceOf(ChannelSendError);
    expect(e.temporary).toBe(false);
    expect(e.message).toContain("not a valid phone number");
  });

  it("says plainly when the person replied STOP", () => {
    expect(explainTwilioError(400, { code: 21610, message: "Attempt to send to unsubscribed recipient" })).toMatchObject({ code: "stopped", temporary: false });
  });

  it("tells the owner to reconnect when Twilio rejects the credentials", () => {
    expect(explainTwilioError(401, { code: 20003 })).toMatchObject({ code: "bad_credentials", temporary: false });
  });

  it("retries a rate limit and a Twilio outage", () => {
    expect(explainTwilioError(429, {})).toMatchObject({ temporary: true });
    expect(explainTwilioError(503, {})).toMatchObject({ temporary: true });
  });

  it("never lets the credentials into an error when Twilio can't be reached", async () => {
    const down = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    const err = await sms.send(down, creds, req()).catch((e) => e);
    expect(err).toMatchObject({ code: "unreachable", temporary: true });
    expect(err.message).not.toContain("token123");
  });
});

describe("downloading a picture", () => {
  it("fetches it from Twilio with the account's credentials", async () => {
    const { f, calls } = fakeTwilio({ "/Media/": { bytes: new Uint8Array([9, 9]), headers: { "content-type": "image/png" } } });
    const out = await sms.download!(f, creds, { id: "SM1-0", url: "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1" });
    expect(out).toMatchObject({ bytes: new Uint8Array([9, 9]), mime: "image/png" });
    expect(calls[0]!.headers.authorization).toMatch(/^Basic /);
  });

  it("never sends the credentials anywhere but Twilio", async () => {
    const { f, calls } = fakeTwilio({});
    await expect(sms.download!(f, creds, { id: "x", url: "https://evil.example.com/a.png" })).rejects.toThrow(/isn't on Twilio/);
    await expect(sms.download!(f, creds, { id: "x", url: "https://api.twilio.com.evil.example/a" })).rejects.toThrow(/isn't on Twilio/);
    expect(calls).toHaveLength(0);
  });

  it("explains a refusal", async () => {
    await expect(sms.download!(fakeTwilio({ "/Media/": { status: 404 } }).f, creds, { id: "x", url: "https://api.twilio.com/Media/1" })).rejects.toThrow(/wouldn't give the file \(404\)/);
  });
});
