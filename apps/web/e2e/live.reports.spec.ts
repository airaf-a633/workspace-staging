import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* Reports on a real server: who may open them, what is shown, and that nothing made-up appears. */
test("the owner sees conversations, team and sales, with no sample numbers, satisfaction or campaigns", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`/w/${SLUG}/reports`);
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible({ timeout: 30_000 });
  for (const name of ["Conversations", "Team", "Sales"]) await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Satisfaction" })).toHaveCount(0);
  await expect(page.getByText("Sample numbers")).toHaveCount(0);
  await expect(page.getByText("Times are clock time")).toBeVisible();
  await page.getByLabel("Time range").selectOption("90");
  await expect(page).toHaveURL(/range=90/);
});

test("an agent has no Reports link and the address is not found", async ({ page }) => {
  await signIn(page, "agent");
  await page.goto(`/w/${SLUG}`);
  await expect(page.getByRole("link", { name: "Reports" })).toHaveCount(0);
  const res = await page.goto(`/w/${SLUG}/reports`);
  expect(res?.status()).toBe(404);
});

test("the numbers come from the database: the total equals the day-by-day sum", async () => {
  const owner = await clientAs("owner");
  const { data: ws } = await owner.from("workspaces").select("id, timezone").eq("slug", SLUG).single();
  const { data, error } = await owner.rpc("report_conversations", { p_workspace: ws!.id, p_days: 30, p_tz: ws!.timezone ?? "UTC" });
  expect(error).toBeNull();
  const days = (data as { days: { n: number }[] }).days;
  expect(days).toHaveLength(30);
  expect(days.reduce((s, d) => s + d.n, 0)).toBe((data as { total: number }).total);
});
