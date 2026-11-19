import { expect, signedInAs, test } from "./fixtures";

// Planning together: Sophie is a member of Lukas's rail trip in the demo data.

test.use({ storageState: signedInAs("sophie") });

test("a member sees the shared trip, its bookings and who owes what", async ({ page }) => {
  await page.goto("/dashboard");
  const card = page.getByRole("link", { name: /Two weeks by train/ }).first();
  await expect(page.getByText(/Shared by Lukas/).first()).toBeVisible();
  await card.click();
  await expect(page.getByRole("heading", { name: "Two weeks by train: Amsterdam to Budapest" })).toBeVisible();

  // Members see the group's confirmation numbers (never shown on public pages)
  await expect(page.getByRole("button", { name: "Copy confirmation number EUR-QX4T9P" })).toBeVisible();

  // ...and can tick things off on the checklist
  await page.getByRole("link", { name: "Checklist" }).click();
  await expect(page.getByRole("checkbox").first()).toBeVisible();

  // Budget: who paid and settling up
  await page.getByRole("link", { name: "Budget" }).click();
  await expect(page.getByRole("heading", { name: "Who paid" })).toBeVisible();
  await expect(page.getByText(/owes €/).first()).toBeVisible();
});
