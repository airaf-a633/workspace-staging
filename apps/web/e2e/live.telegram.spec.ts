import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG, unique, openInbox } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* Telegram from end to end, without a real bot: we play Telegram's part and call the webhook the way Telegram
   does (with its secret header). The bot token is a made-up one, so the reply is refused by the real Telegram
   with "Unauthorized" and the inbox must say so in plain words. */
test("a Telegram message reaches the inbox, and a failed reply explains itself", async ({ page, request }) => {
  const owner = await clientAs("owner");
  const { data: ws } = await owner.from("workspaces").select("id").eq("slug", SLUG).single();
  const botId = String(900_000_000 + Math.floor(Math.random() * 99_999_999));
  const secret = randomBytes(24).toString("base64url");
  const { data: made, error } = await owner.rpc("connect_channel", {
    p_workspace: ws!.id, p_type: "telegram", p_name: unique("@e2e_bot"), p_external_id: botId,
    p_settings: { username: "e2e_bot", bot_id: Number(botId), greeting: "" }, p_secrets: { bot_token: `${botId}:AAE2E-not-a-real-token-0000000000000`, secret_token: secret },
  });
  expect(error).toBeNull();
  const { key } = made as { id: string; key: string };
  const url = `/api/webhooks/telegram/${key}`;
  const headers = { "x-telegram-bot-api-secret-token": secret };
  const chatId = 7_000_000 + Math.floor(Math.random() * 999_999);
  const text = unique("Is the blue one in stock?");
  const update = (message: Record<string, unknown>, id = 1) => ({
    update_id: id,
    message: { message_id: id, date: Math.floor(Date.now() / 1000), chat: { id: chatId, type: "private", first_name: "Ana", last_name: "E2E" }, from: { id: chatId, is_bot: false, first_name: "Ana" }, ...message },
  });

  // Who may call
  expect((await request.post(url, { data: update({ text }) })).status()).toBe(401);
  expect((await request.post(url, { headers: { "x-telegram-bot-api-secret-token": "wrong" }, data: update({ text }) })).status()).toBe(401);
  expect((await request.post(`/api/webhooks/telegram/${"0".repeat(32)}`, { headers, data: update({ text }) })).status()).toBe(404);

  // Things that must be accepted but never become conversations: Start, a group message, an edit
  expect((await request.post(url, { headers, data: update({ text: "/start" }, 2) })).status()).toBe(200);
  expect((await request.post(url, { headers, data: update({ text: "hi group", chat: { id: -100123, type: "supergroup", title: "G" } }, 3) })).status()).toBe(200);
  expect((await request.post(url, { headers, data: { update_id: 4, edited_message: { message_id: 1, chat: { id: chatId, type: "private" }, text: "edited" } } })).status()).toBe(200);

  // A real message, delivered twice (Telegram retries): accepted both times, filed once
  expect((await request.post(url, { headers, data: update({ text }, 5) })).status()).toBe(200);
  expect((await request.post(url, { headers, data: update({ text }, 5) })).status()).toBe(200);

  test.skip(process.env.E2E_WORKER !== "1", "Filing a message needs the worker running (E2E_WORKER=1)");
  await signIn(page, "owner");
  await openInbox(page);
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Ana E2E").first()).toBeVisible();
  await expect(page.getByText("hi group")).toHaveCount(0);
  await expect(page.getByText("/start")).toHaveCount(0);

  // The reply goes to the real Telegram with a made-up token, which Telegram refuses; the inbox says what to do
  await page.getByText(text).first().click();
  // A chat nobody has taken must be taken before replying
  await page.getByRole("button", { name: "Take this chat" }).click();
  await page.getByRole("textbox").last().fill("Yes, in stock!");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/rejected this bot's token/i)).toBeVisible({ timeout: 45_000 });
});
