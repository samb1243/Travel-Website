import { describe, expect, it } from "vitest";
import { exploreHref, hasFilters, parseExploreFilters } from "./explore";

describe("parseExploreFilters", () => {
  it("reads valid filters", () => {
    expect(parseExploreFilters({ type: "HIKING", length: "week", budget: "mid", country: "fr", page: "2" })).toEqual({
      type: "HIKING",
      length: "week",
      budget: "mid",
      country: "FR",
      page: 2,
    });
  });

  it("ignores anything invalid instead of failing", () => {
    expect(
      parseExploreFilters({ type: "SPACE", length: "forever", budget: "'; DROP TABLE", country: "France", page: "-3" }),
    ).toEqual({ type: null, length: null, budget: null, country: null, page: 1 });
    expect(parseExploreFilters({ page: "99999" }).page).toBe(1);
  });

  it("takes the first value when a parameter repeats", () => {
    expect(parseExploreFilters({ type: ["MULTI_CITY", "HIKING"] }).type).toBe("MULTI_CITY");
  });
});

describe("exploreHref", () => {
  it("builds a clean URL", () => {
    expect(exploreHref({})).toBe("/explore");
    expect(exploreHref({ type: "HIKING", country: "CH", page: 1 })).toBe("/explore?type=HIKING&country=CH");
    expect(exploreHref({ budget: "low", page: 3 })).toBe("/explore?budget=low&page=3");
  });

  it("round-trips through the parser", () => {
    const f = parseExploreFilters({ type: "BACKPACKING", length: "long", budget: "high", country: "TH", page: "2" });
    const url = new URL(exploreHref(f), "http://x");
    expect(parseExploreFilters(Object.fromEntries(url.searchParams))).toEqual(f);
  });
});

describe("hasFilters", () => {
  it("ignores the page number", () => {
    expect(hasFilters(parseExploreFilters({ page: "4" }))).toBe(false);
    expect(hasFilters(parseExploreFilters({ country: "JP" }))).toBe(true);
  });
});
