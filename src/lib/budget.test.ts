import { describe, expect, it } from "vitest";
import type { ItemCategory } from "@/generated/prisma/enums";
import type { ItemStatus } from "@/lib/status";
import { budgetLevel, nightsAt, summariseBudget } from "./budget";

const stops = [
  { id: "bkk", name: "Bangkok", arriveOn: "2027-02-01", departOn: "2027-02-04" },
  { id: "cnx", name: "Chiang Mai", arriveOn: "2027-02-04", departOn: null },
];

let n = 0;
const item = (category: ItemCategory, cost: number | null, stopId: string | null = null, status: ItemStatus = "BOOKED") => ({
  id: `i${++n}`,
  category,
  cost,
  stopId,
  status,
});

describe("budgetLevel", () => {
  it("compares spend with the budget", () => {
    expect(budgetLevel(500, null)).toBe("none");
    expect(budgetLevel(500, 0)).toBe("none");
    expect(budgetLevel(500, 1000)).toBe("under");
    expect(budgetLevel(900, 1000)).toBe("near");
    expect(budgetLevel(1000, 1000)).toBe("near");
    expect(budgetLevel(1001, 1000)).toBe("over");
  });
});

describe("nightsAt", () => {
  it("counts nights between arrive and leave dates", () => {
    expect(nightsAt(stops[0])).toBe(3);
    expect(nightsAt(stops[1])).toBeNull();
    expect(nightsAt({ arriveOn: "2027-02-04", departOn: "2027-02-04" })).toBe(0);
  });
});

describe("summariseBudget", () => {
  const items = [
    item("FLIGHT", 640, null),
    item("ACCOMMODATION", 48, "bkk"),
    item("ACTIVITY", 0.1, "bkk", "TO_BOOK"),
    item("ACTIVITY", 0.2, "bkk", "PAY_ON_ARRIVAL"),
    item("FOOD", 15, "cnx", "NOT_NEEDED"),
    item("GEAR", null, "cnx", "NOT_NEEDED"),
  ];
  const summary = summariseBudget(items, stops, { budget: 1000, travellers: 2, durationDays: 10 });

  it("adds up exactly, without floating-point drift", () => {
    expect(summary.total).toBe(703.3); // 0.1 + 0.2 is 0.3, not 0.30000000000000004
    expect(summary.remaining).toBe(296.7);
    expect(summary.usedShare).toBeCloseTo(0.7033, 4);
    expect(summary.level).toBe("under");
  });

  it("works out per person and per day", () => {
    expect(summary.perPerson).toBe(351.65);
    expect(summary.perDay).toBe(70.33);
    expect(summary.perPersonPerDay).toBe(35.17); // 35.165 rounds half up in cents
  });

  it("splits by status, keeping every status", () => {
    expect(summary.byStatus).toEqual([
      { status: "BOOKED", total: 688, count: 2 },
      { status: "PAY_ON_ARRIVAL", total: 0.2, count: 1 },
      { status: "TO_BOOK", total: 0.1, count: 1 },
      { status: "NOT_NEEDED", total: 15, count: 2 },
    ]);
  });

  it("splits by category, biggest first, skipping categories with no cost", () => {
    expect(summary.byCategory.map((c) => [c.category, c.total, c.count])).toEqual([
      ["FLIGHT", 640, 1],
      ["ACCOMMODATION", 48, 1],
      ["FOOD", 15, 1],
      ["ACTIVITY", 0.3, 2],
    ]);
    expect(summary.byCategory.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 6);
  });

  it("splits by stop in route order, with trip-wide costs last", () => {
    expect(summary.byStop.map((s) => [s.name, s.total, s.nights, s.stayPerNight])).toEqual([
      ["Bangkok", 48.3, 3, 16], // only the 48 stay counts per night, not the activities
      ["Chiang Mai", 15, null, null],
      [null, 640, null, null],
    ]);
  });

  it("lists the biggest costs and counts items without a cost", () => {
    expect(summary.biggest.map((i) => i.cost)).toEqual([640, 48, 15, 0.2, 0.1]);
    expect(summary.missingCost).toBe(1);
  });

  it("handles a trip with no budget, dates or costs", () => {
    const empty = summariseBudget([item("OTHER", null)], [], { budget: null, travellers: 0, durationDays: null });
    expect(empty).toMatchObject({
      total: 0,
      budget: null,
      remaining: null,
      usedShare: null,
      level: "none",
      perPerson: 0,
      perDay: null,
      perPersonPerDay: null,
      byCategory: [],
      byStop: [],
      biggest: [],
      missingCost: 1,
    });
  });

  it("flags going over budget", () => {
    const over = summariseBudget([item("FLIGHT", 1200)], [], { budget: 1000, travellers: 1, durationDays: 5 });
    expect(over.level).toBe("over");
    expect(over.remaining).toBe(-200);
  });
});
