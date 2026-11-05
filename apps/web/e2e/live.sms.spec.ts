import { createHmac, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG, unique } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* SMS from end to end, without a real Twilio account: we play Twilio's part and sign each call the way Twilio does
   (base64 HMAC-SHA1 of the exact address plus the sorted fields). The address Twilio signs is the app's public
   address, so NEXT_PUBLIC_SITE_URL must match the address these tests call (or be unset). The Account SID and Auth
   Token are made up, so the real Twilio refuses the reply and the inbox must say so in plain words. */
test("a text reaches the inbox, STOP is recorded, and a failed reply explains itself", async ({ page, request, baseURL }) => {
  const owner = await clientAs("owner");
  const { data: ws } = await owner.from("workspaces").select("id").eq("slug", SLUG).single();
  const number = `+1555${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const authToken = randomBytes(16).toString("hex");
  const { data: made, error } = await owner.rpc("connect_channel", {
    p_workspace: ws!.id, p_type: "sms", p_name: unique("E2E SMS"), p_external_id: number,
    p_settings: { number }, p_secrets: { account_sid: `AC${randomBytes(16).toString("hex")}`, auth_token: authToken },
  });
  expect(error).toBeNull();
  const { key } = made as { id: string; key: string };
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? baseURL!).replace(/\/$/, "");
  const sign = (path: string, fields: Record<string, string>) =>
    createHmac("sha1", authToken).update(origin + path + Object.keys(fields).sort().map((k) => k + fields[k]).join("")).digest("base64");
  const post = (path: string, fields: Record<string, string>, signature?: string) =>
    request.post(path, { form: fields, headers: { "x-twilio-signature": signature ?? sign(path, fields) } });
  const inboundPath = `/api/webhooks/twilio/${key}`;
  const from = `+1555${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const text = unique("Is my order ready?");
  const text1 = { MessageSid: `SM${randomBytes(16).toString("hex")}`, From: from, To: number, Body: text, NumMedia: "0" };

  // Who may call
  expect((await post(inboundPath, text1, "AAAA")).status()).toBe(401);
  expect((await request.post(inboundPath, { form: text1 })).status()).toBe(401);
  expect((await post(`/api/webhooks/twilio/${"0".repeat(32)}`, text1, "AAAA")).status()).toBe(404);

  // A real text, delivered twice (Twilio retries): answered with an empty TwiML each time, filed once
  const first = await post(inboundPath, text1);
  expect(first.status()).toBe(200);
  expect(first.headers()["content-type"]).toContain("xml");
  expect((await post(inboundPath, text1)).status()).toBe(200);

  // A delivery report for a text we never sent is accepted and changes nothing
  const statusPath = `${inboundPath}/status`;
  expect((await post(statusPath, { MessageSid: "SMnope", MessageStatus: "delivered" })).status()).toBe(200);
  expect((await request.post(statusPath, { form: { MessageSid: "SMnope", MessageStatus: "delivered" } })).status()).toBe(401);

  test.skip(process.env.E2E_WORKER !== "1", "Filing a text needs the worker running (E2E_WORKER=1)");
  await signIn(page, "owner");
  await page.goto(`/w/${SLUG}/inbox`);
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 30_000 });

  // The customer texts STOP: Twilio reports OptOutType, Relay shows it in the chat
  expect((await post(inboundPath, { MessageSid: `SM${randomBytes(16).toString("hex")}`, From: from, To: number, Body: "STOP", NumMedia: "0", OptOutType: "STOP" })).status()).toBe(200);
  await page.waitForTimeout(5_000);
  await page.reload();
  await page.getByText(text).first().click();
  await expect(page.getByText(/replied STOP/i)).toBeVisible({ timeout: 30_000 });

  // The reply goes to the real Twilio with made-up credentials, which Twilio refuses; the inbox says what to do
  await page.getByRole("button", { name: "Take this chat" }).click();
  await page.getByRole("textbox").last().fill("Yes, it's ready!");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/rejected this account's credentials/i)).toBeVisible({ timeout: 45_000 });
});
