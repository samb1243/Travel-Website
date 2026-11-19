import { expect, fakePlaceSearch, test } from "./fixtures";

// The core journey for someone new: sign up, create a trip, add a stop and a
// booking, tick it off on the checklist and see it in the budget.

test("sign up and plan a first trip", async ({ page }) => {
  const email = `new-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Robin Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-long-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // New trip
  await page.getByRole("link", { name: "Start a trip" }).click();
  await page.getByLabel("Trip name").fill("Long weekend in Lisbon");
  await page.getByText("City break", { exact: true }).click();
  await page.getByLabel("Start").fill("2027-04-09");
  await page.getByLabel("End").fill("2027-04-12");
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect(page.getByRole("heading", { name: "Long weekend in Lisbon" })).toBeVisible();

  // First stop, found with place search
  await fakePlaceSearch(page, { name: "Lisbon", country: "Portugal", countryCode: "PT", lat: 38.7223, lng: -9.1393 });
  await page.getByRole("button", { name: "Add a stop" }).click();
  await page.getByLabel("Search for a place").fill("Lisbon");
  await page.getByLabel("Search for a place").press("Enter");
  await page.getByRole("list", { name: "Search results" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Add stop" }).click();
  await expect(page.getByText("Lisbon added")).toBeVisible();

  // A booking at that stop, still to book, with a price
  await page.getByRole("button", { name: "Add flight, stay, transport or activity" }).click();
  const form = page.getByRole("dialog");
  await form.getByText("Stay", { exact: true }).click();
  await form.locator("#title").fill("Guesthouse in Alfama");
  await form.getByLabel("Cost").fill("240");
  await form.getByRole("button", { name: /To book/ }).click();
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Guesthouse in Alfama").first()).toBeVisible();

  // Checklist: tick it off as booked
  await page.getByRole("link", { name: "Checklist" }).click();
  const tick = page.getByRole("checkbox", { name: "Mark Guesthouse in Alfama as booked" });
  await tick.click();
  await expect(page.getByRole("checkbox", { name: "Mark Guesthouse in Alfama as to book" })).toHaveAttribute("aria-checked", "true");

  // Budget: the cost counts
  await page.getByRole("link", { name: "Budget" }).click();
  await expect(page.getByText("€240").first()).toBeVisible();

  // Still there after a reload (saved, not just on screen)
  await page.reload();
  await expect(page.getByText("€240").first()).toBeVisible();
});
