import "server-only";
import { db } from "@/lib/db";

// Fixed-window rate limiter kept in Postgres, so every server instance (on
// Vercel each request may land on a different one) shares the same counts.
// One atomic statement per check: two requests at once can't both slip past.

/**
 * Records a hit for `key` and says whether it's within `max` hits per
 * `windowMs`. Keys look like "copy:<userId>".
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = BigInt(Math.floor(now / windowMs) * windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "AppRateLimit" ("key", "windowStart", "count")
    VALUES (${key.slice(0, 200)}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AppRateLimit"."windowStart" = EXCLUDED."windowStart" THEN "AppRateLimit"."count" + 1 ELSE 1 END,
      "windowStart" = EXCLUDED."windowStart"
    RETURNING "count"`;

  // Now and then, clear counters that haven't been used for a day
  if (Math.random() < 0.01) {
    await db.appRateLimit.deleteMany({ where: { windowStart: { lt: BigInt(now - 24 * 60 * 60 * 1000) } } }).catch(() => {});
  }
  return (rows[0]?.count ?? 0) <= max;
}
