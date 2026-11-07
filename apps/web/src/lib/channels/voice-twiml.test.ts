import { describe, expect, it } from "vitest";
import { afterDialTwiml, DEFAULT_NOTICE, incomingTwiml, ring, voiceSettings, voiceUrls, voicemailTwiml } from "./voice-twiml";

const key = "k".repeat(32);
const urls = voiceUrls("https://relay.example/", key);

describe("addresses", () => {
  it("builds all four from the public address and the channel key", () => {
    expect(urls).toEqual({
      incoming: `https://relay.example/api/webhooks/twilio-voice/${key}`,
      dial: `https://relay.example/api/webhooks/twilio-voice/${key}/dial`,
      done: `https://relay.example/api/webhooks/twilio-voice/${key}/done`,
      recording: `https://relay.example/api/webhooks/twilio-voice/${key}/recording`,
    });
  });
});

describe("an incoming call", () => {
  it("rings the owner's phone and names where to go afterwards", () => {
    const x = incomingTwiml({ forwardTo: "+971501234567", ringSeconds: 25 }, urls);
    expect(x).toContain(`<Dial timeout="25" action="${urls.dial}" method="POST">+971501234567</Dial>`);
    expect(x).not.toContain("<Record");
  });

  it("goes straight to the voicemail when no phone is set", () => {
    const x = incomingTwiml({}, urls);
    expect(x).toContain("<Record");
    expect(x).not.toContain("<Dial");
  });

  it("keeps the ring time between 5 and 60 seconds", () => {
    expect([ring(1), ring(500), ring("abc"), ring(undefined), ring(30.4)]).toEqual([5, 60, 20, 20, 30]);
  });
});

describe("the voicemail", () => {
  it("says the greeting, then the notice, then records, with its own actions", () => {
    const x = voicemailTwiml({ greeting: "Leave a message." }, urls);
    expect(x.indexOf("Leave a message.")).toBeGreaterThan(-1);
    expect(x.indexOf("Leave a message.")).toBeLessThan(x.indexOf(DEFAULT_NOTICE));
    expect(x.indexOf(DEFAULT_NOTICE)).toBeLessThan(x.indexOf("<Record"));
    expect(x).toContain(`action="${urls.done}"`);
    expect(x).toContain(`recordingStatusCallback="${urls.recording}"`);
    expect(x).toContain('maxLength="120"');
  });

  it("uses the owner's own words, escaped", () => {
    const x = voicemailTwiml({ greeting: 'Hi & <welcome> "to" us', notice: "Recorded." }, urls);
    expect(x).toContain("<Say>Hi &amp; &lt;welcome&gt; &quot;to&quot; us</Say>");
    expect(x).toContain("<Say>Recorded.</Say>");
  });

  it("leaves out a notice the owner cleared, and cuts very long text", () => {
    expect(voicemailTwiml({ notice: "   " }, urls).match(/<Say>/g)).toHaveLength(1);
    expect(voicemailTwiml({ greeting: "a".repeat(1000) }, urls)).toContain(`<Say>${"a".repeat(300)}</Say>`);
  });
});

describe("after the forwarded call", () => {
  it("hangs up when a person answered", () => {
    expect(afterDialTwiml("completed", {}, urls)).toContain("<Hangup/>");
  });

  it.each(["no-answer", "busy", "failed", "canceled", undefined])("takes a voicemail when the result is %s", (status) => {
    expect(afterDialTwiml(status, {}, urls)).toContain("<Record");
  });
});

describe("reading the channel's settings", () => {
  it("falls back to defaults and ignores junk", () => {
    expect(voiceSettings({})).toEqual({ ringSeconds: 20 });
    expect(voiceSettings({ forward_to: " +1555 ", ring_seconds: "99", greeting: 7 })).toEqual({ forwardTo: "+1555", ringSeconds: 60 });
    expect(voiceSettings({ notice: "" })).toMatchObject({ notice: "" });
  });
});
