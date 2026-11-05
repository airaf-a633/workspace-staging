import { describe, expect, it } from "vitest";
import voice, { parseVoice } from "./voice";
import { ChannelSendError } from "./types";

const SID = "AC" + "a".repeat(32);
const REC = "RE" + "b".repeat(32);
const url = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Recordings/${REC}`;
const call = (over: Record<string, unknown> = {}) => ({ CallSid: "CA123", AccountSid: SID, From: "+1 (555) 123-4567", To: "+15550100", ...over });

describe("a forwarded call that ended", () => {
  it("files an answered call with its length", () => {
    const [m] = parseVoice(call({ _relay: "dial", DialCallStatus: "completed", DialCallDuration: "73" }));
    expect(m).toMatchObject({ kind: "phone", address: "15551234567", externalId: "CA123", type: "call", data: { call: { direction: "in", duration: 73 } } });
    expect((m!.data as { call: { missed?: boolean } }).call.missed).toBeUndefined();
  });

  it.each(["no-answer", "busy", "failed", "canceled"])("files %s as a missed call", (status) => {
    const [m] = parseVoice(call({ _relay: "dial", DialCallStatus: status, DialCallDuration: "0" }));
    expect(m).toMatchObject({ type: "call", data: { call: { direction: "in", missed: true } } });
    expect((m!.data as { call: { duration?: number } }).call.duration).toBeUndefined();
  });
});

describe("a call to a voicemail-only number", () => {
  it("is a missed call", () => {
    expect(parseVoice(call({ _relay: "missed" }))[0]).toMatchObject({ externalId: "CA123", type: "call", data: { call: { missed: true } } });
  });
});

describe("a voicemail", () => {
  const rec = (over: Record<string, unknown> = {}) => call({ _relay: "recording", RecordingSid: REC, RecordingUrl: url, RecordingStatus: "completed", RecordingDuration: "14", ...over });

  it("is an audio message that downloads the recording", () => {
    const [m] = parseVoice(rec());
    expect(m).toMatchObject({ type: "audio", externalId: `vm-${REC}`, data: { call: { direction: "in", voicemail: true, duration: 14 } } });
    expect(m!.media![0]).toMatchObject({ ref: { id: REC, url }, mime: "audio/mpeg" });
  });

  it("is skipped when Twilio says it failed or has no address", () => {
    expect(parseVoice(rec({ RecordingStatus: "failed" }))).toEqual([]);
    expect(parseVoice(rec({ RecordingUrl: "" }))).toEqual([]);
  });
});

describe("what is not filed", () => {
  it("skips a withheld number, an unmarked body and junk", () => {
    expect(parseVoice(call({ _relay: "missed", From: "anonymous" }))).toEqual([]);
    expect(parseVoice(call())).toEqual([]);
    expect(parseVoice(null)).toEqual([]);
    expect(parseVoice(call({ _relay: "missed", CallSid: "" }))).toEqual([]);
  });
});

describe("sending", () => {
  it("always refuses, in plain words", async () => {
    await expect(voice.send(fetch, {}, { messageId: "m", body: "hi", to: "1555", threadKey: "", settings: {}, lastInbound: null, lastInboundAt: null })).rejects.toBeInstanceOf(ChannelSendError);
  });
});

describe("downloading a voicemail", () => {
  const creds = { account_sid: SID, auth_token: "t".repeat(32) };
  const reply = (status: number, body = "audio") => (async () => new Response(body, { status, headers: { "content-type": "audio/mpeg" } })) as unknown as typeof fetch;

  it("asks Twilio for the mp3 with the account's credentials", async () => {
    let asked = "";
    let auth = "";
    const f = (async (u: string, init: RequestInit) => {
      asked = u;
      auth = (init.headers as Record<string, string>).authorization!;
      return new Response("abc", { status: 200 });
    }) as unknown as typeof fetch;
    const got = await voice.download!(f, creds, { id: REC, url });
    expect(asked).toBe(`${url}.mp3`);
    expect(auth).toBe(`Basic ${Buffer.from(`${SID}:${creds.auth_token}`).toString("base64")}`);
    expect(got.mime).toBe("audio/mpeg");
    expect(new TextDecoder().decode(got.bytes)).toBe("abc");
  });

  it("does not double the extension", async () => {
    let asked = "";
    const f = (async (u: string) => { asked = u; return new Response("x"); }) as unknown as typeof fetch;
    await voice.download!(f, creds, { url: `${url}.mp3` });
    expect(asked).toBe(`${url}.mp3`);
  });

  it("never sends credentials anywhere but a Twilio recording address", async () => {
    await expect(voice.download!(reply(200), creds, { url: "https://evil.example/2010-04-01/x.mp3" })).rejects.toThrow(/isn't on Twilio/);
    await expect(voice.download!(reply(200), creds, { url: `https://api.twilio.com.evil.example/2010-04-01/Accounts/${SID}/Recordings/${REC}` })).rejects.toThrow(/isn't on Twilio/);
    await expect(voice.download!(reply(200), creds, { url: `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages/MM1` })).rejects.toThrow(/isn't on Twilio/);
  });

  it("explains a refused login and other failures", async () => {
    await expect(voice.download!(reply(401), creds, { url })).rejects.toThrow(/API key/);
    await expect(voice.download!(reply(404), creds, { url })).rejects.toThrow(/\(404\)/);
  });
});
