import { describe, expect, it } from "vitest";
import { formatTripTypes, normaliseTripTypes, primaryTripType } from "./trip-types";

describe("normaliseTripTypes", () => {
  it("removes duplicates and keeps the standard order", () => {
    expect(normaliseTripTypes(["HIKING", "BACKPACKING", "HIKING"])).toEqual(["BACKPACKING", "HIKING"]);
  });

  it("never returns an empty list", () => {
    expect(normaliseTripTypes([])).toEqual(["OTHER"]);
  });
});

describe("primaryTripType", () => {
  it("is the first type in the standard order", () => {
    expect(primaryTripType(["RAIL", "MULTI_CITY"])).toBe("MULTI_CITY");
  });
});

describe("formatTripTypes", () => {
  it("joins one, two or more types readably", () => {
    expect(formatTripTypes(["HIKING"])).toBe("Hiking");
    expect(formatTripTypes(["MULTI_CITY", "BACKPACKING"])).toBe("Backpacking & Multi-city");
    expect(formatTripTypes(["BACKPACKING", "MULTI_CITY", "RAIL", "BEACH"])).toBe("Backpacking, Multi-city +2");
    expect(formatTripTypes(["BACKPACKING", "MULTI_CITY", "RAIL"], 3)).toBe("Backpacking, Multi-city, Rail journey");
  });
});
