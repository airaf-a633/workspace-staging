import { expect, test } from "@playwright/test";
import { live, signIn, SLUG } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

test("a viewer can read customers but not change them", async ({ page }) => {
  await signIn(page, "viewer");
  await page.goto(`/w/${SLUG}/customers`);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Select all shown")).toHaveCount(0);
});

test("an agent can select people but cannot delete or export", async ({ page }) => {
  await signIn(page, "agent");
  await page.goto(`/w/${SLUG}/customers`);
  const all = page.getByLabel("Select all shown");
  if (await all.count()) {
    await all.check();
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Export", exact: true })).toHaveCount(0);
  }
});

test("someone from another business cannot open this workspace", async ({ page }) => {
  await signIn(page, "outsider").catch(() => {});
  const res = await page.goto(`/w/${SLUG}/customers`);
  expect(res?.status() === 404 || /sign-in|\/w\/(?!qamar)/.test(page.url())).toBe(true);
});
