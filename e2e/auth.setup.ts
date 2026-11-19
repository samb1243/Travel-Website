import { test as setup, expect } from "@playwright/test";
import { DEMO_PASSWORD, signedInAs } from "./fixtures";

// Logs the demo users in once and saves their cookies for the other tests.

for (const who of ["lukas", "sophie"] as const) {
  setup(`log in as ${who}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(`${who}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.context().storageState({ path: signedInAs(who) });
  });
}
