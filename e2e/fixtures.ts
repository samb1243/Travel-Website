import { test as base, expect, type Page } from "@playwright/test";
import pg from "pg";
import { e2eDatabaseUrl } from "./database";

export { expect };

export const DEMO_PASSWORD = "tripstack-demo";

/** Logins saved by auth.setup.ts, so each test starts signed in without logging in again. */
export const signedInAs = (who: "lukas" | "sophie") => `e2e/.auth/${who}.json`;

/**
 * Every test: nothing leaves the machine. Requests to other sites (map tiles,
 * Unsplash photos) are refused, so the tests are fast, don't depend on the
 * internet, and don't load anyone's servers.
 */
export const test = base.extend({
  // (Playwright calls the second argument "use"; renamed so the React hooks lint rule leaves it alone)
  context: async ({ context, baseURL }, provide) => {
    const own = new URL(baseURL!).origin;
    await context.route(
      (url) => url.origin !== own && url.protocol.startsWith("http"),
      (route) => route.abort("blockedbyclient"),
    );
    await provide(context);
  },
});

/** Place search answers with a made-up result instead of asking OpenStreetMap. */
export async function fakePlaceSearch(page: Page, place: { name: string; country: string; countryCode: string; lat: number; lng: number }) {
  await page.route("**/api/geocode?**", (route) =>
    route.fulfill({
      json: {
        places: [
          {
            placeId: `osm:relation:${Math.round(place.lat * 1000)}`,
            name: place.name,
            region: null,
            country: place.country,
            countryCode: place.countryCode,
            lat: place.lat,
            lng: place.lng,
            label: `${place.name}, ${place.country}`,
          },
        ],
      },
    }),
  );
}

/** One value from the browser-test database (e.g. a demo trip's id or link). */
export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T> {
  const db = new pg.Client({ connectionString: e2eDatabaseUrl() });
  await db.connect();
  try {
    const { rows } = await db.query(sql, params);
    if (!rows[0]) throw new Error(`No row for: ${sql}`);
    return rows[0] as T;
  } finally {
    await db.end();
  }
}
