import "server-only";
import { db } from "@/lib/db";
import { APPROX_RATES, isCompleteRateTable, type RateTable } from "@/lib/convert";
import { fetchLatestRates } from "@/lib/rates-fetch";

// Exchange rates with three layers, so a slow or broken rates service never
// breaks the app:
//   1. memory (per server process), refreshed every REFRESH_MS
//   2. the latest snapshot stored in the database
//   3. the rough built-in rates (src/lib/fx.ts)

export type Rates = {
  table: RateTable;
  /** "YYYY-MM-DD" of the rates, null for the built-in rough rates */
  day: string | null;
  source: "live" | "approx";
};

const REFRESH_MS = 12 * 60 * 60 * 1000;

let memo: { rates: Rates; at: number } | null = null;
let inFlight: Promise<Rates> | null = null;

async function load(): Promise<Rates> {
  const stored = await db.exchangeRateSnapshot.findFirst({ orderBy: { fetchedAt: "desc" } });
  if (stored && Date.now() - stored.fetchedAt.getTime() < REFRESH_MS && isCompleteRateTable(stored.rates)) {
    return { table: stored.rates, day: stored.day, source: "live" };
  }
  try {
    const { table, day } = await fetchLatestRates();
    await db.exchangeRateSnapshot.upsert({
      where: { day },
      create: { day, rates: table },
      update: { rates: table, fetchedAt: new Date() },
    });
    return { table, day, source: "live" };
  } catch (e) {
    console.warn("[rates] using stored or rough rates:", e instanceof Error ? e.message : e);
    if (stored && isCompleteRateTable(stored.rates)) return { table: stored.rates, day: stored.day, source: "live" };
    return { table: APPROX_RATES, day: null, source: "approx" };
  }
}

/** Current exchange rates. Fast after the first call; never throws. */
export async function getRates(): Promise<Rates> {
  if (memo && Date.now() - memo.at < REFRESH_MS) return memo.rates;
  inFlight ??= load()
    .then((rates) => {
      memo = { rates, at: Date.now() };
      return rates;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
