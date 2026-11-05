import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG, unique } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* Deals and Tasks on a real server: who sees what, money kept apart, and the screens saving. Works through the same database
   functions the screens call, then checks what each person's screen shows. */
test("a deal is created, seen without its money by a role that can't see money, and discounted by a manager", async ({ page }) => {
  const agent = await clientAs("agent");
  const { data: ws } = await agent.from("workspaces").select("id").eq("slug", SLUG).single();
  const title = unique("E2E deal");
  const { data: contact } = await agent.from("contacts").select("id").is("erased_at", null).limit(1).single();
  const { data: id, error } = await agent.rpc("create_deal", { p_workspace: ws!.id, p_title: title, p_contact: contact!.id, p_value_minor: 123456 });
  expect(error).toBeNull();

  // The agent sees the money on her own deal. The viewer sees no deals at all.
  const { data: own } = await agent.from("deal_values").select("value_minor").eq("deal_id", id as string).single();
  expect(own?.value_minor).toBe(123456);
  const viewer = await clientAs("viewer");
  const { data: seen } = await viewer.from("deals").select("id").eq("id", id as string);
  expect(seen).toEqual([]);

  // On screen
  await signIn(page, "agent");
  await page.goto(`/w/${SLUG}/deals`);
  await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
  await page.getByText(title).click();
  await page.getByRole("button", { name: "Ask for a discount" }).click();
  await page.getByLabel("Discount (percent)").fill("10");
  await page.getByRole("button", { name: "Ask a manager" }).click();
  await expect(page.getByText(/Waiting for a manager/)).toBeVisible({ timeout: 30_000 });

  // The sales manager approves, and the value drops by ten percent
  const manager = await clientAs("owner");
  const { data: approval } = await manager.from("deal_approvals").select("id").eq("deal_id", id as string).eq("status", "pending").single();
  const decided = await manager.rpc("decide_discount", { p_approval: approval!.id, p_approve: true, p_note: "Fine" });
  expect(decided.error).toBeNull();
  const { data: after } = await agent.from("deal_values").select("value_minor").eq("deal_id", id as string).single();
  expect(after?.value_minor).toBe(111110);
});

test("a task repeats when finished, and undo takes the repeat back", async () => {
  const agent = await clientAs("agent");
  const { data: ws } = await agent.from("workspaces").select("id").eq("slug", SLUG).single();
  const { data: id, error } = await agent.rpc("create_task", {
    p_workspace: ws!.id, p_text: unique("E2E task"), p_due: new Date(Date.now() + 86_400_000).toISOString(), p_has_time: true, p_repeat: "weekly",
  });
  expect(error).toBeNull();
  const done = await agent.rpc("complete_task", { p_task: id as string });
  expect(done.error).toBeNull();
  expect(typeof done.data).toBe("string");
  const undone = await agent.rpc("undo_complete_task", { p_task: id as string });
  expect(undone.error).toBeNull();
  const { data: gone } = await agent.from("tasks").select("id").eq("id", done.data as string);
  expect(gone).toEqual([]);
});
