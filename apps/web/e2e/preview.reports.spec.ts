import { expect, test } from "@playwright/test";

/* Reports in the design preview (made-up numbers): the screen was split so a real workspace can feed it, and must still work. */

test("the owner's preview reports show the sample label and every tab, including satisfaction and campaigns", async ({ page }) => {
  await page.goto("/preview/elena/reports");
  await expect(page.getByText("Sample numbers")).toBeVisible({ timeout: 45_000 });
  for (const name of ["Conversations", "Team", "Satisfaction", "Sales and campaigns"]) await expect(page.getByRole("tab", { name })).toBeVisible();
  await page.getByRole("tab", { name: "Sales and campaigns" }).click();
  await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible();
  await page.getByRole("tab", { name: "Satisfaction" }).click();
  await expect(page.getByText("Ratings received")).toBeVisible();
});

test("changing the time range changes the preview numbers and the filters stay put", async ({ page }) => {
  await page.goto("/preview/elena/reports");
  const range = page.getByLabel("Time range");
  await expect(range).toBeVisible({ timeout: 45_000 });
  const before = await page.locator("dl").first().innerText();
  await range.selectOption("90");
  await expect(range).toHaveValue("90");
  expect(await page.locator("dl").first().innerText()).not.toBe(before);
});
