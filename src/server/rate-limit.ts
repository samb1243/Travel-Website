import "server-only";

// Simple sliding-window rate limiter, kept in memory.
// Good enough for one server process. With several instances (serverless,
// load-balanced) each keeps its own counts; move this to Redis/Upstash then.

const buckets = new Map<string, number[]>();

/**
 * Records a hit for `key` and says whether it's within `max` hits per
 * `windowMs`. Keys look like "copy:<userId>".
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // Keep memory bounded: drop idle keys now and then.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}
