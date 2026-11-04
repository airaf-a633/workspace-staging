import { expect, test } from "@playwright/test";

/* Settings › Reply targets in the design preview (nothing is stored): rules, each team's hours and closed days, and who may change what. */

test("the owner sees the rules and every team's hours, and can change them (the preview stores nothing)", async ({ page }) => {
  await page.goto("/preview/elena/sla");
  await expect(page.getByRole("heading", { name: "Reply targets" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("VIP customers")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Opening hours" })).toBeVisible();
  for (const team of ["General", "Sales", "Support"]) await expect(page.getByRole("button", { name: team, exact: true })).toBeVisible();

  // Sales is shut on Sundays in the sample; change Friday and save
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  const friday = page.getByRole("listitem").filter({ hasText: /^Fri/ });
  await friday.getByRole("checkbox", { name: "Open", exact: true }).uncheck();
  await expect(friday.getByText("Closed")).toBeVisible();
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByRole("status").filter({ hasText: "In the preview nothing is stored" })).toBeVisible();
});

test("a closed day can be added to a team and removed again", async ({ page }) => {
  await page.goto("/preview/elena/sla");
  await expect(page.getByRole("heading", { name: "Closed days and special hours" })).toBeVisible({ timeout: 45_000 });
  // Let the time-zone check and any dev-server reload finish first; they refresh the page and would wipe what is typed.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add a closed day" }).click();
  await page.getByLabel("First day").fill("2027-03-05");
  await page.getByLabel("Name (optional)").fill("Founders day");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Founders day")).toBeVisible();
  await expect(page.getByText("Mar 5, 2027")).toBeVisible();
  await page.getByRole("button", { name: /Remove\W*Founders day/ }).click();
  await expect(page.getByText("Founders day")).toHaveCount(0);
});

test("a day with special hours is refused when it closes before it opens", async ({ page }) => {
  await page.goto("/preview/elena/sla");
  await expect(page.getByRole("heading", { name: "Closed days and special hours" })).toBeVisible({ timeout: 45_000 });
  // Let the time-zone check and any dev-server reload finish first; they refresh the page and would wipe what is typed.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add a closed day" }).click();
  await page.getByLabel("First day").fill("2027-03-05");
  await page.getByLabel("Open different hours").check();
  const form = page.locator("form");
  await form.getByLabel("Opens at").fill("15:00");
  await form.getByLabel("Closes at").fill("10:00");
  await expect(page.getByRole("alert").filter({ hasText: "Closing must be after opening" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
});

test("a new rule appears in the list", async ({ page }) => {
  await page.goto("/preview/elena/sla");
  await expect(page.getByRole("button", { name: "Add a rule" })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Add a rule" }).click();
  await page.getByLabel("Rule name").fill("Weekend promise");
  await page.getByRole("button", { name: "Save rule" }).click();
  await expect(page.getByText("Weekend promise")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Weekend promise" })).toContainText("an answer within");
});

test("a team manager changes their own team's hours and rules, but not another team's", async ({ page }) => {
  await page.goto("/preview/priya/sla");
  await expect(page.getByRole("heading", { name: "Opening hours" })).toBeVisible({ timeout: 45_000 });
  // Priya is on Support. She can start a rule that names her team, but not change the alert settings.
  await expect(page.getByRole("button", { name: "Add a rule" })).toBeVisible();
  await expect(page.getByText("Only people who manage teams can change reply targets")).toBeVisible();
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  await expect(page.getByText("Only a manager of this team can change its hours.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save hours" })).toHaveCount(0);
  await page.getByRole("button", { name: "Support", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save hours" })).toBeVisible();
  await page.getByRole("button", { name: "Add a rule" }).click();
  await page.getByLabel("Rule name").fill("Support promise");
  await expect(page.getByRole("alert").filter({ hasText: "Pick at least one team for this rule" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save rule" })).toBeDisabled();
  await page.getByRole("group", { name: "Teams" }).getByRole("button", { name: "Support" }).click();
  await expect(page.getByRole("button", { name: "Save rule" })).toBeEnabled();
});

test("an agent can read the reply targets but not change them", async ({ page }) => {
  await page.goto("/preview/leo/sla");
  await expect(page.getByRole("heading", { name: "Opening hours" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("VIP customers")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a rule" })).toHaveCount(0);
  await expect(page.getByText("Only a manager of this team can change its hours.")).toBeVisible();
});
