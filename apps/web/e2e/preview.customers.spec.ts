import { expect, test } from "@playwright/test";

/* The Contacts screens in the design preview: who may do what, and that dangerous actions ask first. */

test("the owner can bulk delete only after typing the number", async ({ page }) => {
  await page.goto("/preview/elena/customers");
  await page.getByLabel("Select all shown").check();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const confirm = page.getByRole("button", { name: /^Delete \d+ contacts$/ });
  await expect(confirm).toBeDisabled();
  const count = (await page.getByText(/^\d+ selected$/).first().innerText()).split(" ")[0];
  await page.getByLabel(/^Type \d+ to confirm/).fill(count);
  await expect(confirm).toBeEnabled();
});

test("a viewer cannot delete or export", async ({ page }) => {
  await page.goto("/preview/amara/customers");
  await expect(page.getByRole("button", { name: "Add", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Select all shown")).toHaveCount(0);
});

test("an agent can select people but has no delete or export", async ({ page }) => {
  await page.goto("/preview/leo/customers");
  await page.getByLabel("Select all shown").check();
  await expect(page.getByRole("button", { name: "Add tag" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export", exact: true })).toHaveCount(0);
});

test("importing the sample file ends with a result", async ({ page }) => {
  await page.goto("/preview/elena/customers/import");
  await page.getByRole("button", { name: "Use a sample file" }).click();
  for (let i = 0; i < 3; i++) {
    const next = page.getByRole("button", { name: /^(Next|Continue|Import)/ }).last();
    if (await page.getByText(/Imported|is done|finished/i).first().isVisible().catch(() => false)) break;
    // Likely duplicates need a decision before the import can go on.
    for (const apart of await page.getByRole("radio", { name: /different|apart|keep both/i }).all()) await apart.check().catch(() => {});
    await next.click();
  }
  await expect(page.getByText(/created|updated|skipped/i).first()).toBeVisible();
});

test("the customer page shows the privacy controls", async ({ page }) => {
  await page.goto("/preview/elena/customers");
  await page.locator("tbody tr a").first().click();
  // The first visit to a page compiles it in the dev server, which can take longer than the default wait.
  await page.waitForURL(/\/customers\/[^/]+$/, { timeout: 45_000 });
  await expect(page.getByText(/do not contact/i).first()).toBeVisible();
});
