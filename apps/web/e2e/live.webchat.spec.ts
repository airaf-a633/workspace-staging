import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG, unique } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* Website chat from end to end: a visitor writes through the public API, the team sees it in the inbox,
   and (with the worker running, E2E_WORKER=1) the visitor sees the team's reply. */
test("a visitor message reaches the inbox and the reply gets back", async ({ page, request }) => {
  const owner = await clientAs("owner");
  const { data: ws } = await owner.from("workspaces").select("id").eq("slug", SLUG).single();
  const { data: team } = await owner.from("teams").select("id").eq("workspace_id", ws!.id).limit(1).single();
  const { data: channel, error } = await owner.rpc("create_webchat_channel", {
    p_workspace: ws!.id,
    p_name: unique("E2E site"),
    p_settings: { team_id: team!.id },
  });
  expect(error).toBeNull();
  const { data: row } = await owner.from("channels").select("external_id").eq("id", channel.id ?? channel).single();
  const key = row!.external_id as string;

  const secret = randomBytes(32).toString("base64url");
  const headers = { "x-relay-visitor": secret };
  const text = unique("Do you ship to Lisbon?");

  // The widget configuration loads
  expect((await request.get(`/api/widget/${key}`)).ok()).toBe(true);
  // The visitor writes; a retry with the same id is harmless
  const body = { clientId: randomBytes(8).toString("hex"), body: text, name: "E2E Visitor" };
  expect((await request.post(`/api/widget/${key}/messages`, { headers, data: body })).status()).toBe(201);
  expect((await request.post(`/api/widget/${key}/messages`, { headers, data: body })).status()).toBe(201);
  const thread = await (await request.get(`/api/widget/${key}/messages`, { headers })).json();
  expect(thread.messages.filter((m: { body: string }) => m.body === text)).toHaveLength(1);
  // Another visitor's secret sees nothing of this thread
  const stranger = { "x-relay-visitor": randomBytes(32).toString("base64url") };
  const other = await (await request.get(`/api/widget/${key}/messages`, { headers: stranger })).json();
  expect(other.messages).toHaveLength(0);

  // The team sees it
  await signIn(page, "owner");
  await page.goto(`/w/${SLUG}/inbox`);
  await expect(page.getByText(text).first()).toBeVisible();

  // The team replies, and the worker delivers it
  test.skip(process.env.E2E_WORKER !== "1", "Reply delivery needs the worker running (E2E_WORKER=1)");
  await page.getByText(text).first().click();
  const reply = unique("Yes, we do");
  await page.getByRole("textbox").last().fill(reply);
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => JSON.stringify(await (await request.get(`/api/widget/${key}/messages`, { headers })).json()), { timeout: 30_000 })
    .toContain(reply);
});
