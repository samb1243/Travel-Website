import { expect, signedInAs, test } from "./fixtures";

// Read-only offline: after visiting My trips, upcoming trips open with no connection.

test.use({ storageState: signedInAs("lukas") });

test("an upcoming trip opens offline", async ({ page, context }) => {
  await page.goto("/dashboard");
  // The first visit installs the service worker; the second saves the trips
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByText(/saved for offline use/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/updated/)).toBeVisible({ timeout: 30_000 });

  const tripLink = page.getByRole("link", { name: /Two weeks by train/ }).first();
  const href = await tripLink.getAttribute("href");

  await context.setOffline(true);
  await page.goto(href!);
  await expect(page.getByRole("heading", { name: "Two weeks by train: Amsterdam to Budapest" })).toBeVisible();
  await expect(page.getByText(/offline/i).first()).toBeVisible();
  // With the confirmation numbers, for the border
  await expect(page.getByRole("button", { name: "Copy confirmation number EUR-QX4T9P" })).toBeVisible();

  // Its other tabs were saved too
  await page.goto(`${href}/checklist`);
  await expect(page.getByRole("checkbox").first()).toBeVisible();
  await context.setOffline(false);
});
