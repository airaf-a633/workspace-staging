import { expect, test } from "@playwright/test";
import { clientAs, live, signIn, SLUG } from "./live.helpers";

test.skip(!live, "Live suite: set E2E_LIVE=1 with staging awake (migration 20261108000001 applied)");

/* Pilot feedback on a real server: anyone in the workspace can send it, and nobody signed in can read it back. */
test("an agent sends feedback from the menu and sees a thank-you", async ({ page }) => {
  await signIn(page, "agent");
  await page.goto(`/w/${SLUG}/inbox`);
  await page.getByRole("link", { name: "Send feedback" }).click();
  await expect(page).toHaveURL(/feedback\?from=/);
  await page.getByLabel("Something is confusing").check();
  await page.getByLabel("What happened, or what do you need?").fill("Live test: where do I find my tasks?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thank you. We read every message.")).toBeVisible();
});

test("nobody signed in can read feedback, and an empty message is refused", async () => {
  const owner = await clientAs("owner");
  const read = await owner.from("pilot_feedback").select("id").limit(1);
  expect(read.error).not.toBeNull();
  const { data: ws } = await owner.from("workspaces").select("id").eq("slug", SLUG).single();
  const empty = await owner.rpc("send_feedback", { p_workspace: ws!.id, p_kind: "other", p_body: "   ", p_page: null });
  expect(empty.error?.message).toContain("bad_body");
});
