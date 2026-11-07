import { createHmac, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG, unique, openInbox } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* Voice from end to end, without a real Twilio account: we play Twilio's part and sign each call the way Twilio
   does (base64 HMAC-SHA1 of the exact address plus the sorted fields). The address Twilio signs is the app's public
   address, so NEXT_PUBLIC_SITE_URL must match the address these tests call (or be unset). The Account SID and Auth
   Token are made up, so the real Twilio refuses to hand over the voicemail file and the inbox must say so. */
test("a call rings the owner's phone, a missed call and voicemail reach the inbox, and a failed download explains itself", async ({ page, request, baseURL }) => {
  const owner = await clientAs("owner");
  const { data: ws } = await owner.from("workspaces").select("id").eq("slug", SLUG).single();
  const number = `+1555${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const authToken = randomBytes(16).toString("hex");
  const accountSid = `AC${randomBytes(16).toString("hex")}`;
  const { data: made, error } = await owner.rpc("connect_channel", {
    p_workspace: ws!.id, p_type: "voice", p_name: unique("E2E Voice"), p_external_id: number,
    p_settings: { number, forward_to: "+15550000001", ring_seconds: 12, greeting: "We are closed.", notice: "Recorded for quality." },
    p_secrets: { account_sid: accountSid, auth_token: authToken },
  });
  expect(error).toBeNull();
  const { key } = made as { id: string; key: string };
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? baseURL!).replace(/\/$/, "");
  const sign = (path: string, fields: Record<string, string>) =>
    createHmac("sha1", authToken).update(origin + path + Object.keys(fields).sort().map((k) => k + fields[k]).join("")).digest("base64");
  const post = (path: string, fields: Record<string, string>, signature?: string) =>
    request.post(path, { form: fields, headers: { "x-twilio-signature": signature ?? sign(path, fields) } });
  const base = `/api/webhooks/twilio-voice/${key}`;
  const from = `+1555${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const callSid = `CA${randomBytes(16).toString("hex")}`;
  const call = { CallSid: callSid, AccountSid: accountSid, From: from, To: number, CallStatus: "ringing" };

  // Who may call
  expect((await post(base, call, "AAAA")).status()).toBe(401);
  expect((await request.post(base, { form: call })).status()).toBe(401);
  expect((await post(`/api/webhooks/twilio-voice/${"0".repeat(32)}`, call, "AAAA")).status()).toBe(404);
  expect((await post(`${base}/nonsense`, call)).status()).toBe(404);

  // A call arrives: Twilio is told to ring the owner's phone for 12 seconds, and to come back afterwards
  const incoming = await post(base, call);
  expect(incoming.status()).toBe(200);
  expect(incoming.headers()["content-type"]).toContain("xml");
  const ringing = await incoming.text();
  expect(ringing).toContain('<Dial timeout="12"');
  expect(ringing).toContain("+15550000001");
  expect(ringing).toContain(`${base}/dial`);

  // Nobody answered: Twilio is told to play the owner's words, then the notice, then record
  const missed = await post(`${base}/dial`, { ...call, DialCallStatus: "no-answer", DialCallDuration: "0" });
  expect(missed.status()).toBe(200);
  const voicemail = await missed.text();
  expect(voicemail.indexOf("We are closed.")).toBeGreaterThan(-1);
  expect(voicemail.indexOf("We are closed.")).toBeLessThan(voicemail.indexOf("Recorded for quality."));
  expect(voicemail.indexOf("Recorded for quality.")).toBeLessThan(voicemail.indexOf("<Record"));

  // Someone did answer: the call just ends
  const answered = await post(`${base}/dial`, { ...call, CallSid: `CA${randomBytes(16).toString("hex")}`, DialCallStatus: "completed", DialCallDuration: "61" });
  expect(await answered.text()).toContain("<Hangup/>");

  // The caller finished the message
  expect(await (await post(`${base}/done`, { ...call, RecordingUrl: "https://example.test", RecordingDuration: "9" })).text()).toContain("<Hangup/>");

  // The recording is ready (the file itself is at the real Twilio, which will refuse our made-up credentials)
  const recordingSid = `RE${randomBytes(16).toString("hex")}`;
  const recording = { ...call, RecordingSid: recordingSid, RecordingStatus: "completed", RecordingDuration: "9", RecordingUrl: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}` };
  expect((await post(`${base}/recording`, recording)).status()).toBe(200);
  expect((await post(`${base}/recording`, recording)).status()).toBe(200);

  test.skip(process.env.E2E_WORKER !== "1", "Filing a call needs the worker running (E2E_WORKER=1)");
  await signIn(page, "owner");
  await openInbox(page);
  await expect(page.getByText("Voicemail").first()).toBeVisible({ timeout: 30_000 });
  await page.getByText("Voicemail").first().click();
  await expect(page.getByText("Missed call").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/couldn't save this voicemail/i)).toBeVisible({ timeout: 45_000 });

  // A phone line can't send text: the box offers a call instead
  await page.getByRole("button", { name: "Take this chat" }).click();
  await expect(page.getByRole("link", { name: /^Call \+/ })).toBeVisible();
});
