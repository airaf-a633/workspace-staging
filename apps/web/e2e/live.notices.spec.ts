import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG, unique } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* Notifications on a real server: a discount asked by an agent reaches the owner's bell, read state is saved, and Home
   lists it under "Needs you now". Uses the same database functions the screens call. */
test("an agent's discount request reaches the owner's bell and Home, and reading it sticks", async ({ page }) => {
  const agent = await clientAs("agent");
  const { data: ws } = await agent.from("workspaces").select("id").eq("slug", SLUG).single();
  const { data: contact } = await agent.from("contacts").select("id").is("erased_at", null).limit(1).single();
  const title = unique("E2E bell deal");
  const { data: deal, error } = await agent.rpc("create_deal", { p_workspace: ws!.id, p_title: title, p_contact: contact!.id, p_value_minor: 50000 });
  expect(error).toBeNull();
  const asked = await agent.rpc("request_discount", { p_deal: deal as string, p_percent: 12 });
  expect(asked.error).toBeNull();

  // The agent is not told about her own request.
  const { data: own } = await agent.from("notifications").select("id").eq("kind", "discount_asked").eq("deal_id", deal as string);
  expect(own).toEqual([]);

  await signIn(page, "owner");
  await page.goto(`/w/${SLUG}`);
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Notifications/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Notifications" }).getByText(/asks for 12% off/)).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read" }).click();

  // Still read after a reload: it was saved, not just hidden.
  await page.reload();
  await expect(page.getByRole("button", { name: "Notifications", exact: true }).first()).toBeVisible({ timeout: 30_000 });
  const owner = await clientAs("owner");
  const { data: unread } = await owner.from("notifications").select("id").is("read_at", null);
  expect(unread).toEqual([]);
});
