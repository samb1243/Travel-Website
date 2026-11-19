import { expect, queryOne, signedInAs, test } from "./fixtures";

// "Never expose private trips": what visitors and other users can and can't see.

const railTrip = "/t/two-weeks-by-train-amsterdam-to-budapest-eurail2027";

test.describe("logged out", () => {
  test("Explore shows public trips only", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByText("Two weeks by train: Amsterdam to Budapest").first()).toBeVisible();
    await expect(page.getByText("Tour du Mont Blanc: 8 stages, 3 countries").first()).toBeVisible();
    await expect(page.getByText("Japan in cherry blossom season")).toHaveCount(0);
  });

  test("a public trip's page leaves out confirmation numbers and private notes", async ({ page }) => {
    await page.goto(railTrip);
    await expect(page.getByRole("heading", { name: "Two weeks by train: Amsterdam to Budapest" })).toBeVisible();
    const html = await page.content();
    for (const secret of ["IR-58810234", "POL-77120", "EUR-QX4T9P"]) expect(html).not.toContain(secret);
  });

  test("a private trip's link says not found", async ({ page }) => {
    const { slug } = await queryOne<{ slug: string }>(`SELECT slug FROM "Trip" WHERE title LIKE 'Japan in cherry blossom%'`);
    await page.goto(`/t/${slug}`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("Japan in cherry blossom season")).toHaveCount(0);
  });

  test("planning pages send you to log in", async ({ page }) => {
    await page.goto("/trips/new");
    await expect(page).toHaveURL(/\/login\?next=%2Ftrips%2Fnew/);
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });
});

test.describe("someone else's private trip", () => {
  test.use({ storageState: signedInAs("lukas") });

  test("is not found, by link or by id", async ({ page }) => {
    const { id, slug } = await queryOne<{ id: string; slug: string }>(`SELECT id, slug FROM "Trip" WHERE title LIKE 'Japan in cherry blossom%'`);
    // (Pages stream, so the HTTP status is already sent: check what's shown)
    for (const path of [`/trips/${id}`, `/t/${slug}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
      await expect(page.getByText("Japan in cherry blossom season")).toHaveCount(0);
    }
  });
});
