import { createHmac, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG, unique } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* LINE from end to end, without a real account: we play LINE's part and sign each call with the channel secret,
   exactly as LINE does (base64 HMAC-SHA256 of the raw body in x-line-signature). The access token is made up, so
   LINE's real servers refuse the profile lookup (the customer stays unnamed) and the reply (the inbox must say the
   token was rejected, in plain words). */
test("a LINE message reaches the inbox, a block shows in the chat, and a failed reply explains itself", async ({ page, request }) => {
  const owner = await clientAs("owner");
  const { data: ws } = await owner.from("workspaces").select("id").eq("slug", SLUG).single();
  const bot = `U${randomBytes(16).toString("hex")}`;
  const user = `U${randomBytes(16).toString("hex")}`;
  const secret = randomBytes(16).toString("hex");
  const { data: made, error } = await owner.rpc("connect_channel", {
    p_workspace: ws!.id, p_type: "line", p_name: unique("E2E LINE"), p_external_id: bot,
    p_settings: { bot_user_id: bot, greeting: "" }, p_secrets: { channel_secret: secret, access_token: "not-a-real-line-token-0000000000" },
  });
  expect(error).toBeNull();
  const { key } = made as { id: string; key: string };
  const url = `/api/webhooks/line/${key}`;
  const send = (body: unknown, signature?: string) => {
    const raw = JSON.stringify(body);
    return request.post(url, {
      headers: { "content-type": "application/json", ...(signature === undefined ? { "x-line-signature": createHmac("sha256", secret).update(raw).digest("base64") } : signature ? { "x-line-signature": signature } : {}) },
      data: raw,
    });
  };
  const text = unique("Do you deliver to Osaka?");
  const event = (type: string, extra: Record<string, unknown> = {}) => ({ type, mode: "active", timestamp: Date.now(), webhookEventId: unique("ev"), source: { type: "user", userId: user }, replyToken: "rt-" + randomBytes(4).toString("hex"), ...extra });

  // Who may call
  expect((await send({ destination: bot, events: [] }, "")).status()).toBe(401);
  expect((await send({ destination: bot, events: [] }, "AAAA")).status()).toBe(401);
  expect((await request.post(`/api/webhooks/line/${"0".repeat(32)}`, { data: { destination: bot, events: [] } })).status()).toBe(404);

  // LINE's Verify button: an empty list, properly signed
  expect((await send({ destination: bot, events: [] })).status()).toBe(200);

  // Adding the account as a friend, and a message in a group, are accepted but never become conversations
  expect((await send({ destination: bot, events: [event("follow", { follow: { isUnblocked: false } })] })).status()).toBe(200);
  expect((await send({ destination: bot, events: [event("message", { source: { type: "group", groupId: "G1", userId: user }, message: { id: "g1", type: "text", text: "hi group" } })] })).status()).toBe(200);

  // A real message, delivered twice (redelivery): accepted both times, filed once
  const message = event("message", { message: { id: String(Date.now()), type: "text", text } });
  expect((await send({ destination: bot, events: [message] })).status()).toBe(200);
  expect((await send({ destination: bot, events: [message] })).status()).toBe(200);

  test.skip(process.env.E2E_WORKER !== "1", "Filing a message needs the worker running (E2E_WORKER=1)");
  await signIn(page, "owner");
  await page.goto(`/w/${SLUG}/inbox`);
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("hi group")).toHaveCount(0);

  // The person blocks the account: the chat says so
  expect((await send({ destination: bot, events: [event("unfollow")] })).status()).toBe(200);
  await page.waitForTimeout(5_000);
  await page.reload();
  await page.getByText(text).first().click();
  await expect(page.getByText(/blocked your account/i)).toBeVisible({ timeout: 30_000 });

  // The reply goes to the real LINE with a made-up token, which LINE refuses; the inbox says what to do
  await page.getByRole("button", { name: "Take this chat" }).click();
  await page.getByRole("textbox").last().fill("Yes, we do!");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/rejected this channel's access token/i)).toBeVisible({ timeout: 45_000 });
});
