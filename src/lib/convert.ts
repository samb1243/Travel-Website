// Currency conversion. Pure (unit-tested); the rates come from src/server/rates.ts.
//
// A rate table says how many units of each currency one euro buys, e.g.
// { EUR: 1, USD: 1.0998, THB: 37.2 }. Amounts are converted in whole cents,
// like every other sum in the app, so totals never drift.

import { APPROX_EUR_PER_UNIT } from "@/lib/fx";
import { CURRENCY_CODES } from "@/lib/currencies";
import { fromCents, toCents, type MoneyLike } from "@/lib/money";

/** Units of each currency per 1 EUR */
export type RateTable = Record<string, number>;

/** The built-in rough rates (src/lib/fx.ts) as a table: the last-resort fallback. */
export const APPROX_RATES: RateTable = Object.fromEntries(
  CURRENCY_CODES.map((c) => [c, 1 / APPROX_EUR_PER_UNIT[c]]),
);

/** Converts whole cents between currencies, or null if a rate is missing. */
export function convertCents(cents: number, from: string, to: string, rates: RateTable): number | null {
  if (from === to) return cents;
  const rFrom = rates[from];
  const rTo = rates[to];
  if (!rFrom || !rTo || !Number.isFinite(rFrom) || !Number.isFinite(rTo)) return null;
  return Math.round((cents / rFrom) * rTo);
}

/** Converts an amount (e.g. 14000 JPY) into another currency, rounded to cents. */
export function convertAmount(amount: MoneyLike, from: string, to: string, rates: RateTable): number | null {
  const cents = convertCents(toCents(amount), from, to, rates);
  return cents === null ? null : fromCents(cents);
}

/**
 * A booking's cost in the trip's currency. `itemCurrency` null means it's
 * already priced in the trip currency. Falls back to the rough built-in rates
 * if the live table lacks a currency.
 */
export function costInTripCurrency(
  cost: MoneyLike | null,
  itemCurrency: string | null,
  tripCurrency: string,
  rates: RateTable,
): number | null {
  if (cost === null) return null;
  const from = itemCurrency ?? tripCurrency;
  return convertAmount(cost, from, tripCurrency, rates) ?? convertAmount(cost, from, tripCurrency, APPROX_RATES);
}

/** Checks a rate table from outside: every app currency present, all positive numbers. */
export function isCompleteRateTable(value: unknown): value is RateTable {
  if (!value || typeof value !== "object") return false;
  const table = value as Record<string, unknown>;
  return CURRENCY_CODES.every((c) => typeof table[c] === "number" && Number.isFinite(table[c]) && (table[c] as number) > 0);
}
