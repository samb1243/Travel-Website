import { DEMO_PASSWORD, expect, test } from "./fixtures";

// Logging in and out. Uses Maya, so the saved logins of the other tests stay valid.

test("wrong password, then log in, then log out", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("maya@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /password/i })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  // Logins are limited to 3 tries per 10 seconds, and the setup has just used two:
  // if this one is refused ("Too many attempts"), wait and try again like a person would
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await expect(async () => {
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 3_000 });
  }).toPass({ intervals: [4_000], timeout: 30_000 });
  await expect(page.getByText("Three weeks in Thailand, Laos & Vietnam").first()).toBeVisible();

  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).not.toHaveURL(/\/dashboard/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
