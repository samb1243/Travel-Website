import { describe, expect, it } from "vitest";
import { formatMoney, formatPrice, itemPriceParts, sumMoney } from "./money";

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

describe("itemPriceParts", () => {
  it("shows prices in the trip currency as they are", () => {
    expect(itemPriceParts(45, null, "USD", 45)).toEqual({ main: "$45", converted: null });
    expect(itemPriceParts(null, null, "USD", null)).toBeNull();
  });

  it("adds the converted amount for foreign prices", () => {
    const p = itemPriceParts(14000, "JPY", "USD", 88);
    expect(p?.converted).toBe("≈ $88");
    expect(p?.main).toContain("14,000");
  });

  it("keeps free as free", () => {
    expect(itemPriceParts(0, "THB", "USD", 0)).toEqual({ main: "Free", converted: null });
  });
});
