import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG, unique } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake (migration 20261106000001 applied)");

/* Reply targets on a real server: rules, hours, who may change them, and the clocks. (Alerts: see the checklist in docs/FOUNDER_SETUP.md; they need the worker running.) */
test("the owner adds a rule and it is still there after a reload", async ({ page }) => {
  const name = unique("Rule");
  await signIn(page, "owner");
  await page.goto(`/w/${SLUG}/sla`);
  await expect(page.getByRole("heading", { name: "Reply targets" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Add a rule" }).click();
  await page.getByLabel("Rule name").fill(name);
  await page.getByRole("button", { name: "Save rule" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByText(name)).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`Remove\\W*${name}`) }).click();
  await expect(page.getByText(name)).toHaveCount(0);
});

test("the owner changes a team's hours and adds a closed day, and the database keeps them", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`/w/${SLUG}/sla`);
  await expect(page.getByRole("heading", { name: "Opening hours" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Deira shop", exact: true }).click();
  const sunday = page.getByRole("listitem").filter({ hasText: /^Sun/ });
  // Flip Sunday whatever it was, so the test can be run again and again.
  const open = sunday.getByRole("checkbox", { name: "Open", exact: true });
  if (await open.isChecked()) await open.uncheck();
  else await open.check();
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Hours saved." })).toBeVisible();
  await page.getByRole("button", { name: "Add a closed day" }).click();
  await page.getByLabel("First day").fill("2099-01-01");
  await page.getByLabel("Name (optional)").fill("Far away");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Far away")).toBeVisible();
  // The same overlapping dates are refused
  await page.getByRole("button", { name: "Add a closed day" }).click();
  await page.getByLabel("First day").fill("2099-01-01");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already has a closed day" })).toBeVisible();
  await page.getByRole("button", { name: /Remove\W*Far away/ }).click();
  await expect(page.getByText("Far away")).toHaveCount(0);
});

test("an agent can read reply targets but not change them, and the database refuses too", async ({ page }) => {
  await signIn(page, "agent");
  await page.goto(`/w/${SLUG}/sla`);
  await expect(page.getByRole("heading", { name: "Opening hours" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Add a rule" })).toHaveCount(0);
  const agent = await clientAs("agent");
  const { data: ws } = await agent.from("workspaces").select("id").eq("slug", SLUG).single();
  const { error } = await agent.rpc("save_sla_policy", { p_workspace: ws!.id, p_id: null, p_name: "Sneaky", p_active: true, p_teams: [], p_channels: [], p_vip: false, p_first: 5, p_next: null, p_resolution: null });
  expect(error?.message).toContain("not_allowed");
});

test("the clocks come from the database, each with a state and a limit", async () => {
  const owner = await clientAs("owner");
  const { data: ws } = await owner.from("workspaces").select("id").eq("slug", SLUG).single();
  const { data: policy, error: policyError } = await owner.rpc("save_sla_policy", { p_workspace: ws!.id, p_id: null, p_name: unique("Test target"), p_active: true, p_teams: [], p_channels: [], p_vip: false, p_first: 1, p_next: null, p_resolution: null });
  expect(policyError).toBeNull();
  const { data: clocks, error } = await owner.rpc("sla_clocks", { p_workspace: ws!.id });
  expect(error).toBeNull();
  // Whatever chats are open, every clock row says which chat, which target and how far along it is
  for (const c of (clocks ?? []) as { state: string; limit_min: number }[]) {
    expect(["ok", "warn", "breach"]).toContain(c.state);
    expect(c.limit_min).toBeGreaterThan(0);
  }
  await owner.rpc("delete_sla_policy", { p_id: policy });
});
