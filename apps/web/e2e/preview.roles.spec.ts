import { expect, test } from "@playwright/test";

/* Every preview person can open Home, the Inbox and Contacts without an error page. */
for (const who of ["elena", "noah", "marcus", "priya", "kenji", "leo", "amara"]) {
  for (const path of ["", "/inbox", "/customers", "/tasks", "/settings"]) {
    test(`${who} can open ${path || "home"}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(`/preview/${who}${path}`);
      expect(res?.status()).toBeLessThan(400);
      await expect(page.locator("main")).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
