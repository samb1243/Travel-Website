// Fetches today's exchange rates. Kept free of server-only imports so the seed
// script can use it too; the app goes through src/server/rates.ts, which adds
// caching and fallbacks.
//
// Source: ExchangeRate-API's open endpoint (no key; daily updates; their terms
// ask for a "Rates by Exchange Rate API" credit, shown on the budget page).
// Only "today's rates" are requested; nothing about users or trips is sent.

import { CURRENCY_CODES } from "@/lib/currencies";
import { isCompleteRateTable, type RateTable } from "@/lib/convert";

export const RATES_URL = process.env.EXCHANGE_RATES_URL ?? "https://open.er-api.com/v6/latest/EUR";
export const RATES_CREDIT = { label: "Rates by Exchange Rate API", href: "https://www.exchangerate-api.com" };

type Response = { result?: string; base_code?: string; time_last_update_unix?: number; rates?: unknown };

/** Today's rates (units per 1 EUR) for the app's currencies, or throws. */
export async function fetchLatestRates(): Promise<{ table: RateTable; day: string }> {
  const res = await fetch(RATES_URL, { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Exchange rates request failed (${res.status})`);
  const body = (await res.json()) as Response;
  if (body.result !== "success" || body.base_code !== "EUR" || !isCompleteRateTable(body.rates)) {
    throw new Error("Exchange rates response wasn't in the expected format");
  }
  const all = body.rates as RateTable;
  const table: RateTable = Object.fromEntries(CURRENCY_CODES.map((c) => [c, all[c]]));
  const updated = body.time_last_update_unix ? new Date(body.time_last_update_unix * 1000) : new Date();
  return { table, day: updated.toISOString().slice(0, 10) };
}
