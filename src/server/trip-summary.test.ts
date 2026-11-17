import { describe, expect, it } from "vitest";
import { computeTripSummary } from "./trip-summary";
import { parseDateOnly as d } from "@/lib/dates";

const stop = (countryCode: string | null, arriveOn?: string, departOn?: string) => ({
  countryCode,
  arriveOn: arriveOn ? d(arriveOn) : null,
  departOn: departOn ? d(departOn) : null,
});

describe("computeTripSummary", () => {
  it("counts trip days inclusively from the trip dates", () => {
    const s = computeTripSummary({
      startDate: d("2027-03-01"),
      endDate: d("2027-03-21"),
      stops: [],
      items: [],
    });
    expect(s.durationDays).toBe(21);
  });

  it("falls back to the stop dates when the trip has none", () => {
    const s = computeTripSummary({
      startDate: null,
      endDate: null,
      stops: [stop("TH", "2027-03-05", "2027-03-08"), stop("LA", "2027-03-08", "2027-03-10")],
      items: [],
    });
    expect(s.durationDays).toBe(6);
  });

  it("returns null duration when there are no dates at all", () => {
    const s = computeTripSummary({ startDate: null, endDate: null, stops: [stop("TH")], items: [] });
    expect(s.durationDays).toBeNull();
  });

  it("lists each country once, in route order", () => {
    const s = computeTripSummary({
      startDate: null,
      endDate: null,
      stops: [stop("th"), stop("TH"), stop(null), stop("LA"), stop("VN"), stop("TH")],
      items: [],
    });
    expect(s.countryCodes).toEqual(["TH", "LA", "VN"]);
  });

  it("sums costs exactly, including items with no booking needed", () => {
    const s = computeTripSummary({
      startDate: null,
      endDate: null,
      stops: [],
      items: [
        { cost: "0.10" },
        { cost: "0.20" },
        { cost: 15 },
        { cost: null },
        { cost: "4.70" },
      ],
    });
    expect(s.totalCost).toBe(20);
  });
});
