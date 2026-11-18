import { describe, expect, it } from "vitest";
import { APPROX_RATES, convertAmount, convertCents, costInTripCurrency, isCompleteRateTable } from "./convert";

const rates = { EUR: 1, USD: 1.1, THB: 37.2, JPY: 175 };

describe("convertCents", () => {
  it("returns the same amount for the same currency", () => {
    expect(convertCents(12345, "USD", "USD", rates)).toBe(12345);
  });

  it("converts through the euro and rounds to whole cents", () => {
    expect(convertCents(110_00, "USD", "EUR", rates)).toBe(100_00);
    expect(convertCents(1_000_00, "THB", "USD", rates)).toBe(Math.round((1_000_00 / 37.2) * 1.1)); // 29.57
  });

  it("returns null when a rate is missing or broken", () => {
    expect(convertCents(100, "XXX", "USD", rates)).toBeNull();
    expect(convertCents(100, "USD", "THB", { ...rates, THB: Number.NaN })).toBeNull();
  });
});

describe("convertAmount", () => {
  it("converts yen to dollars", () => {
    expect(convertAmount(14000, "JPY", "USD", rates)).toBe(88);
  });
});

describe("costInTripCurrency", () => {
  it("treats no currency as the trip currency", () => {
    expect(costInTripCurrency(45, null, "USD", rates)).toBe(45);
  });

  it("converts foreign prices and keeps free as free", () => {
    expect(costInTripCurrency(1000, "THB", "USD", rates)).toBe(29.57);
    expect(costInTripCurrency(0, "JPY", "USD", rates)).toBe(0);
    expect(costInTripCurrency(null, "JPY", "USD", rates)).toBeNull();
  });

  it("falls back to the rough built-in rates if the live table lacks a currency", () => {
    expect(costInTripCurrency(100, "VND", "USD", rates)).not.toBeNull();
  });
});

describe("isCompleteRateTable", () => {
  it("accepts a table with every app currency", () => {
    expect(isCompleteRateTable(APPROX_RATES)).toBe(true);
  });

  it("rejects tables that are missing currencies or have bad values", () => {
    expect(isCompleteRateTable(rates)).toBe(false);
    expect(isCompleteRateTable({ ...APPROX_RATES, USD: -1 })).toBe(false);
    expect(isCompleteRateTable({ ...APPROX_RATES, USD: "1.1" })).toBe(false);
    expect(isCompleteRateTable(null)).toBe(false);
  });
});
