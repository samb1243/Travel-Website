import { expect, signedInAs, test } from "./fixtures";

// Explore → open someone's public trip → copy it to my trips, without their personal details.

test.use({ storageState: signedInAs("lukas") });

test("copy a public trip from Explore", async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("link", { name: /Three weeks in Thailand, Laos & Vietnam/ }).first().click();
  await expect(page.getByRole("heading", { name: "Three weeks in Thailand, Laos & Vietnam" })).toBeVisible();

  await page.getByRole("button", { name: "Copy this trip" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Copy to my trips" }).click();

  // Now it's Lukas's own trip to edit
  await expect(page).toHaveURL(/\/trips\/[^/]+$/);
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Three weeks in Thailand, Laos & Vietnam/ })).toBeVisible();

  // Maya's confirmation numbers and private notes didn't come along
  await page.getByRole("link", { name: "Checklist" }).click();
  await expect(page.getByRole("checkbox").first()).toBeVisible();
  const html = await page.content();
  for (const secret of ["TG7Q2K", "WN-2027-448190", "Seat 42A"]) expect(html).not.toContain(secret);
});
