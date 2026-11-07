import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { live, signIn, SLUG, unique } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake");

/* One customer through their whole life: add, find, export, erase. Runs as the owner. */
test("add, export and erase a customer", async ({ page }) => {
  const name = unique("E2E Customer");
  const email = `${name.replace(/\W+/g, "").toLowerCase()}@example.com`;
  await signIn(page, "owner");
  await page.goto(`/w/${SLUG}/customers`);

  // Add
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Name").fill(name);
  // (A channel icon in the list is also labelled "Email", so find the field by its type.)
  await page.locator('input[type="email"]').fill(email);
  await page.getByRole("button", { name: "Add contact" }).click();
  await expect(page.getByText(name).first()).toBeVisible();

  // Still there after a reload: it really saved
  await page.reload();
  await expect(page.getByText(name).first()).toBeVisible();

  // Export the list as CSV
  await page.locator("tr", { hasText: name }).getByRole("checkbox").check();
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const csv = readFileSync((await (await csvDownload).path())!, "utf8");
  expect(csv).toContain(name);
  expect(csv).toContain(email);

  // Export their full record from their page
  await page.getByRole("link", { name }).first().click();
  // Export and Erase live in the "More actions" menu on the customer page.
  await page.getByLabel("More actions").click();
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /export/i }).first().click();
  expect(readFileSync((await (await jsonDownload).path())!, "utf8")).toContain(email);

  // Erase: asks for the name first, then the customer is gone from the list
  await page.getByRole("button", { name: /^Erase /i }).first().click();
  await page.getByLabel(new RegExp(`type .*${name}`, "i")).fill(name);
  await page.getByRole("button", { name: new RegExp(`^Erase\\W*${name.split(" ")[0]}`, "i") }).last().click();
  await expect(page.getByText("Erased.")).toBeVisible();
  await page.goto(`/w/${SLUG}/customers`);
  await expect(page.getByText(name)).toHaveCount(0);
});

test.fixme("a duplicate is merged and nothing is lost", async () => {
  // Needs two customers created through the app; add once the add flow is confirmed on staging.
});
