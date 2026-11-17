// Rough exchange rates, used ONLY so Explore can filter trips priced in
// different currencies by one budget scale ("under €1,000 per person").
// Trips always show their own currency; nothing is converted on screen.
// Phase 2 (multi-currency) replaces this with live rates.
//
// Value = approximate euros per 1 unit of the currency (late 2026).

import type { CurrencyCode } from "@/lib/currencies";

export const APPROX_EUR_PER_UNIT: Record<CurrencyCode, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  AUD: 0.6,
  CAD: 0.67,
  NZD: 0.55,
  CHF: 1.05,
  SEK: 0.088,
  NOK: 0.086,
  DKK: 0.134,
  PLN: 0.23,
  CZK: 0.04,
  HUF: 0.0025,
  TRY: 0.026,
  JPY: 0.0061,
  CNY: 0.127,
  KRW: 0.00067,
  SGD: 0.69,
  HKD: 0.118,
  THB: 0.026,
  VND: 0.000036,
  IDR: 0.000057,
  MYR: 0.2,
  PHP: 0.016,
  INR: 0.011,
  AED: 0.25,
  ZAR: 0.05,
  MAD: 0.092,
  MXN: 0.05,
  BRL: 0.17,
  ARS: 0.0009,
  CLP: 0.00097,
  PEN: 0.25,
  COP: 0.00023,
};

/** Approximate value in euros, rounded to cents; null for an unknown currency. */
export function approxEur(amount: number, currency: string): number | null {
  const rate = APPROX_EUR_PER_UNIT[currency as CurrencyCode];
  if (rate === undefined) return null;
  return Math.round(amount * rate * 100) / 100;
}
