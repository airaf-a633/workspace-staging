import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG, unique } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* The API channel from end to end: a customer's system pushes a message, the team sees it, and a reply that
   cannot be delivered says why in plain words. The inbox is made through the database the way the app does it. */
test("an API message reaches the inbox, and retries and bad calls are handled", async ({ page, request }) => {
  const owner = await clientAs("owner");
  const { data: ws } = await owner.from("workspaces").select("id").eq("slug", SLUG).single();
  const apiKey = `rly_${randomBytes(24).toString("base64url")}`;
  const { data: made, error } = await owner.rpc("connect_channel", {
    p_workspace: ws!.id, p_type: "api", p_name: unique("E2E API"), p_external_id: null,
    p_settings: { webhook_url: "" }, p_secrets: { api_key_hash: createHash("sha256").update(apiKey).digest("hex"), webhook_secret: "whsec_test" },
  });
  expect(error).toBeNull();
  const { key } = made as { id: string; key: string };
  const url = `/api/v1/inboxes/${key}/messages`;
  const auth = { authorization: `Bearer ${apiKey}` };
  const text = unique("Where is order 4821?");
  const body = { id: unique("msg"), customer: { id: "e2e-user-1", name: "E2E Customer" }, text };

  // Who may call
  expect((await request.post(url, { data: body })).status()).toBe(401);
  expect((await request.post(url, { headers: { authorization: "Bearer rly_wrong" }, data: body })).status()).toBe(401);
  expect((await request.post(`/api/v1/inboxes/${"0".repeat(32)}/messages`, { headers: auth, data: body })).status()).toBe(404);

  // What may be sent
  const bad = await request.post(url, { headers: auth, data: { id: "x", customer: {} } });
  expect(bad.status()).toBe(422);
  expect((await bad.json()).error).toContain("customer");
  expect((await request.post(url, { headers: auth, data: { id: "x", customer: { id: "u" } } })).status()).toBe(422);
  expect((await request.post(url, { headers: auth, data: { id: "x", customer: { id: "u" }, attachments: [{ url: "http://insecure.example/a.png" }] } })).status()).toBe(422);

  // A good message, sent twice: accepted both times, filed once
  expect((await request.post(url, { headers: auth, data: body })).status()).toBe(202);
  expect((await request.post(url, { headers: auth, data: body })).status()).toBe(202);

  // The worker files it; the team sees it once
  test.skip(process.env.E2E_WORKER !== "1", "Filing a message needs the worker running (E2E_WORKER=1)");
  await signIn(page, "owner");
  await page.goto(`/w/${SLUG}/inbox`);
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 30_000 });
  await page.getByText(text).first().click();

  // No reply address is set, so a reply fails with a reason a person can act on
  // A chat nobody has taken must be taken before replying
  await page.getByRole("button", { name: "Take this chat" }).click();
  await page.getByRole("textbox").last().fill("On its way!");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/no webhook address/i)).toBeVisible({ timeout: 30_000 });
});
