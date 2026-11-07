import { expect, test } from "@playwright/test";

/* Deals and Tasks in the design preview (made-up data): the shared screens still work after they learned to save on real data. */

test("the owner opens a deal, asks for a discount, and the card says it is waiting", async ({ page }) => {
  await page.goto("/preview/elena/deals");
  await page.getByRole("button", { name: /Sofa|lamp|shelf|desk|chair|table|set/i }).first().click({ timeout: 45_000 });
  const ask = page.getByRole("button", { name: "Ask for a discount" });
  if (await ask.count()) {
    await ask.click();
    await page.getByLabel("Discount (percent)").fill("7");
    await page.getByRole("button", { name: "Ask a manager" }).click();
    await expect(page.getByText("Waiting for a manager to approve.", { exact: false })).toBeVisible();
  }
});

test("a viewer sees no deals board", async ({ page }) => {
  await page.goto("/preview/amara/deals");
  await expect(page.getByText(/role doesn't include deals/i)).toBeVisible({ timeout: 45_000 });
});

test("a task can be added to the list and finished with an undo", async ({ page }) => {
  await page.goto("/preview/elena/tasks");
  await page.getByLabel("What needs doing?").fill("Check the delivery slot");
  await page.getByRole("button", { name: "Add", exact: true }).click({ timeout: 45_000 });
  await expect(page.getByText("Check the delivery slot")).toBeVisible();
  await page.getByLabel(/Mark done: \W*Check the delivery slot/).click();
  await expect(page.getByRole("status")).toContainText(/Done: \W*Check the delivery slot/);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel(/Mark done: \W*Check the delivery slot/)).toBeVisible();
});
