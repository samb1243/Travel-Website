import { describe, expect, it } from "vitest";
import { continentOf, countriesIn } from "./continents";
import { countryScope, exploreHref, hasFilters, parseExploreFilters } from "./explore";

describe("parseExploreFilters", () => {
  it("reads valid filters", () => {
    expect(
      parseExploreFilters({
        type: "HIKING",
        continent: "eu",
        country: "fr,IT",
        minDays: "5",
        maxDays: "10",
        minBudget: "500",
        maxBudget: "2000",
        cur: "gbp",
        page: "2",
      }),
    ).toEqual({
      type: "HIKING",
      continent: "EU",
      countries: ["FR", "IT"],
      minDays: 5,
      maxDays: 10,
      minBudget: 500,
      maxBudget: 2000,
      currency: "GBP",
      page: 2,
    });
  });

  it("accepts repeated country parameters too", () => {
    expect(parseExploreFilters({ country: ["TH", "VN,LA"] }).countries).toEqual(["TH", "VN", "LA"]);
  });

  it("ignores anything invalid instead of failing", () => {
    expect(
      parseExploreFilters({
        type: "SPACE",
        continent: "Atlantis",
        country: "France,'; DROP TABLE",
        minDays: "-3",
        maxDays: "lots",
        minBudget: "1e9",
        maxBudget: "99999999",
        cur: "BTC",
        page: "-3",
      }),
    ).toEqual({
      type: null,
      continent: null,
      countries: [],
      minDays: null,
      maxDays: null,
      minBudget: null,
      maxBudget: null,
      currency: null,
      page: 1,
    });
    expect(parseExploreFilters({ page: "99999" }).page).toBe(1);
  });

  it("swaps a minimum and maximum given the wrong way round", () => {
    const f = parseExploreFilters({ minDays: "14", maxDays: "7", minBudget: "3000", maxBudget: "1000" });
    expect([f.minDays, f.maxDays, f.minBudget, f.maxBudget]).toEqual([7, 14, 1000, 3000]);
  });

  it("drops countries that aren't in the chosen continent", () => {
    expect(parseExploreFilters({ continent: "AS", country: "TH,FR" }).countries).toEqual(["TH"]);
  });
});

describe("exploreHref", () => {
  it("builds a clean URL", () => {
    expect(exploreHref({})).toBe("/explore");
    expect(exploreHref({ type: "HIKING", countries: ["CH", "FR"], page: 1 })).toBe("/explore?type=HIKING&country=CH%2CFR");
    expect(exploreHref({ maxBudget: 750, currency: "EUR", page: 3 })).toBe("/explore?maxBudget=750&cur=EUR&page=3");
    // The currency alone isn't a filter
    expect(exploreHref({ currency: "EUR" })).toBe("/explore");
  });

  it("round-trips through the parser", () => {
    const f = parseExploreFilters({ type: "BACKPACKING", continent: "AS", country: "TH,LA", minDays: "18", maxBudget: "4000", cur: "USD", page: "2" });
    const url = new URL(exploreHref(f), "http://x");
    expect(parseExploreFilters(Object.fromEntries(url.searchParams))).toEqual(f);
  });
});

describe("hasFilters", () => {
  it("ignores the page number and the currency", () => {
    expect(hasFilters(parseExploreFilters({ page: "4", cur: "USD" }))).toBe(false);
    expect(hasFilters(parseExploreFilters({ country: "JP" }))).toBe(true);
    expect(hasFilters(parseExploreFilters({ maxDays: "7" }))).toBe(true);
  });
});

describe("countryScope", () => {
  it("prefers picked countries, then the whole continent", () => {
    expect(countryScope({ continent: "AS", countries: ["TH"] })).toEqual(["TH"]);
    expect(countryScope({ continent: "SA", countries: [] })).toContain("PE");
    expect(countryScope({ continent: null, countries: [] })).toBeNull();
  });
});

describe("continents", () => {
  it("knows where countries are", () => {
    expect(continentOf("th")).toBe("AS");
    expect(continentOf("PT")).toBe("EU");
    expect(continentOf("CR")).toBe("NA");
    expect(continentOf("ZZ")).toBeNull();
  });

  it("puts every country in exactly one continent", () => {
    const all = (["AF", "AS", "EU", "NA", "SA", "OC", "AN"] as const).flatMap(countriesIn);
    expect(new Set(all).size).toBe(all.length);
  });
});
