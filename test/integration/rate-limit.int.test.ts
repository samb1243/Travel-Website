// The shared rate limiter: counts held in Postgres, atomic under parallel requests.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { rateLimit } from "@/server/rate-limit";

describe("rateLimit", () => {
  it("lets exactly `max` hits through, even when they arrive at once", async () => {
    const key = `test:${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 25 }, () => rateLimit(key, 20, 60_000)));
    expect(results.filter(Boolean)).toHaveLength(20);
  });

  it("starts counting again in the next window, and keeps keys apart", async () => {
    const key = `test:${randomUUID()}`;
    expect(await rateLimit(key, 1, 50)).toBe(true);
    expect(await rateLimit(`${key}-other`, 1, 50)).toBe(true);
    await new Promise((r) => setTimeout(r, 120));
    expect(await rateLimit(key, 1, 50)).toBe(true);
  });
});
