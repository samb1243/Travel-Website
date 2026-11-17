import { describe, expect, it } from "vitest";
import { formatMoney, formatPrice, sumMoney } from "./money";

describe("formatPrice", () => {
  it("shows a price of 0 as Free", () => {
    expect(formatPrice(0, "EUR")).toBe("Free");
    expect(formatPrice("0.00", "USD")).toBe("Free");
  });

  it("shows other prices as money", () => {
    expect(formatPrice(45, "EUR")).toBe(formatMoney(45, "EUR"));
    expect(formatPrice(12.5, "USD")).toBe("$12.50");
  });
});

describe("sumMoney", () => {
  it("adds exactly in cents", () => {
    expect(sumMoney([0.1, 0.2, null, "1.05"])).toBe(1.35);
  });
});
