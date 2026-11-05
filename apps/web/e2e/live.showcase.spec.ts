import { expect, test } from "@playwright/test";
import { live, signIn, SLUG } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* Campaigns, Help Center and Billing in a real workspace are designed screens with sample data, and say so (decided 2026-11-03). */
test("the owner can open Campaigns, the Help Center and Billing, each marked as a preview", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`/w/${SLUG}`);
  await expect(page.getByRole("link", { name: /^Campaigns/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /^Help Center/ })).toBeVisible();
  for (const path of ["campaigns", "help", "billing"]) {
    await page.goto(`/w/${SLUG}/${path}`);
    await expect(page.getByRole("note").filter({ hasText: "not live yet" })).toBeVisible();
  }
});

test("an agent sees the Help Center preview but neither Campaigns nor Billing", async ({ page }) => {
  await signIn(page, "agent");
  await page.goto(`/w/${SLUG}`);
  await expect(page.getByRole("link", { name: /^Help Center/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /^Campaigns/ })).toHaveCount(0);
  expect((await page.goto(`/w/${SLUG}/campaigns`))?.status()).toBe(404);
  expect((await page.goto(`/w/${SLUG}/billing`))?.status()).toBe(404);
});
