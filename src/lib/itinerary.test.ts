import { describe, expect, it } from "vitest";
import type { ItemCategory } from "@/generated/prisma/enums";
import { buildItinerary, timeOf } from "./itinerary";

const stops = [
  { id: "bkk", name: "Bangkok", arriveOn: "2027-02-01", departOn: "2027-02-03" },
  { id: "cnx", name: "Chiang Mai", arriveOn: "2027-02-03", departOn: "2027-02-05" },
];
const trip = { startDate: "2027-02-01", endDate: "2027-02-05" };

let n = 0;
const item = (
  category: ItemCategory,
  startAt: string | null,
  endAt: string | null = null,
  extra: { stopId?: string | null; allDay?: boolean; id?: string } = {},
) => ({ id: extra.id ?? `i${++n}`, stopId: extra.stopId ?? null, category, startAt, endAt, allDay: extra.allDay ?? false });

describe("timeOf", () => {
  it("returns HH:MM, or null for all-day and midnight-only dates", () => {
    expect(timeOf("2027-02-01T18:40:00.000Z", false)).toBe("18:40");
    expect(timeOf("2027-02-01T00:00:00.000Z", false)).toBeNull();
    expect(timeOf("2027-02-01T18:40:00.000Z", true)).toBeNull();
    expect(timeOf(null, false)).toBeNull();
  });
});

describe("buildItinerary", () => {
  it("draws every trip day, numbered, with the stops you're at", () => {
    const { days } = buildItinerary([], stops, trip);
    expect(days.map((d) => [d.date, d.dayNumber, d.places.map((p) => p.name).join("+")])).toEqual([
      ["2027-02-01", 1, "Bangkok"],
      ["2027-02-02", 2, "Bangkok"],
      ["2027-02-03", 3, "Bangkok+Chiang Mai"],
      ["2027-02-04", 4, "Chiang Mai"],
      ["2027-02-05", 5, "Chiang Mai"],
    ]);
  });

  it("splits stays and overnight journeys into start and end entries", () => {
    const hostel = item("ACCOMMODATION", "2027-02-01T14:00:00.000Z", "2027-02-03T11:00:00.000Z", { id: "hostel" });
    const train = item("TRANSPORT", "2027-02-03T18:40:00.000Z", "2027-02-04T07:15:00.000Z", { id: "train" });
    const { days } = buildItinerary([hostel, train], stops, trip);
    const summary = days.map((d) => d.entries.map((e) => `${e.item.id}:${e.kind}@${e.time}`));
    expect(summary).toEqual([
      ["hostel:start@14:00"],
      [],
      ["hostel:end@11:00", "train:start@18:40"],
      ["train:end@07:15"],
      [],
    ]);
  });

  it("records where you sleep each night, but not on the last day", () => {
    const hostel = item("ACCOMMODATION", "2027-02-01T14:00:00.000Z", "2027-02-03T11:00:00.000Z", { id: "hostel" });
    const train = item("TRANSPORT", "2027-02-03T18:40:00.000Z", "2027-02-04T07:15:00.000Z", { id: "train" });
    const { days } = buildItinerary([hostel, train], stops, trip);
    expect(days.map((d) => (d.night ? (d.night.kind === "none" ? "none" : `${d.night.kind}:${d.night.item.id}`) : null))).toEqual([
      "stay:hostel",
      "stay:hostel",
      "travel:train",
      "none",
      null,
    ]);
  });

  it("shows other multi-day items on their first day only", () => {
    const pass = item("OTHER", "2027-02-01T00:00:00.000Z", "2027-02-05T00:00:00.000Z", { id: "pass", allDay: true });
    const { days } = buildItinerary([pass], stops, trip);
    expect(days.map((d) => d.entries.length)).toEqual([1, 0, 0, 0, 0]);
    expect(days[0].entries[0]).toMatchObject({ kind: "single", time: null });
  });

  it("puts all-day entries first, then sorts by time", () => {
    const late = item("FOOD", "2027-02-02T19:00:00.000Z", null, { id: "dinner" });
    const early = item("ACTIVITY", "2027-02-02T08:30:00.000Z", null, { id: "temple" });
    const allDay = item("ACTIVITY", "2027-02-02T00:00:00.000Z", null, { id: "hike", allDay: true });
    const { days } = buildItinerary([late, early, allDay], stops, trip);
    expect(days[1].entries.map((e) => e.item.id)).toEqual(["hike", "temple", "dinner"]);
  });

  it("adds sparse day cards for items outside the trip dates", () => {
    const gear = item("GEAR", "2027-01-10T00:00:00.000Z", null, { id: "jacket" });
    const { days } = buildItinerary([gear], stops, trip);
    expect(days[0]).toMatchObject({ date: "2027-01-10", dayNumber: null, night: null });
    expect(days).toHaveLength(6); // not every day from 10 Jan
  });

  it("works out the range from stops when the trip has no dates", () => {
    const { days } = buildItinerary([], stops, { startDate: null, endDate: null });
    expect(days.map((d) => d.dayNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns no days when nothing is dated", () => {
    const undatedStops = stops.map((s) => ({ ...s, arriveOn: null, departOn: null }));
    const { days } = buildItinerary([item("ACTIVITY", null)], undatedStops, { startDate: null, endDate: null });
    expect(days).toEqual([]);
  });

  it("lists undated items by stop in route order, trip-wide last", () => {
    const items = [
      item("OTHER", null, null, { id: "visa" }),
      item("ACTIVITY", null, null, { id: "temple", stopId: "cnx" }),
      item("FOOD", null, null, { id: "market", stopId: "bkk" }),
      item("FOOD", "2027-02-02T19:00:00.000Z", null, { id: "dated", stopId: "bkk" }),
    ];
    const { unscheduled } = buildItinerary(items, stops, trip);
    expect(unscheduled.map((g) => [g.stopName, g.items.map((i) => i.id)])).toEqual([
      ["Bangkok", ["market"]],
      ["Chiang Mai", ["temple"]],
      [null, ["visa"]],
    ]);
  });
});
