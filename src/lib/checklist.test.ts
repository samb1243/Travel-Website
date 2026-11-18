import { describe, expect, it } from "vitest";
import {
  BOOKING_ORDER,
  bookingGroupOf,
  buildChecklist as build,
  countStatuses,
  nextPaymentOnTap,
  nextStatusOnTap,
  PAYMENT_ORDER,
  paymentGroupOf,
  urgencyFor,
  urgencyLabel,
} from "./checklist";
import type { ItemStatus } from "./status";

const stops = [
  { id: "bkk", name: "Bangkok", arriveOn: "2027-02-01" },
  { id: "cnx", name: "Chiang Mai", arriveOn: "2027-02-05" },
];

const item = (id: string, status: ItemStatus | null, stopId: string | null, startAt: string | null = null) => ({
  id,
  status,
  stopId,
  startAt,
});

const buildChecklist = <T extends { id: string; stopId: string | null; startAt: string | null; status: ItemStatus | null }>(
  items: T[],
  s: typeof stops,
  today: string,
) => build(items, s, today, BOOKING_ORDER, bookingGroupOf);

describe("urgencyFor", () => {
  it("buckets by days until the item", () => {
    expect(urgencyFor(null)).toBe("undated");
    expect(urgencyFor(-1)).toBe("overdue");
    expect(urgencyFor(0)).toBe("soon");
    expect(urgencyFor(14)).toBe("soon");
    expect(urgencyFor(15)).toBe("upcoming");
    expect(urgencyFor(45)).toBe("upcoming");
    expect(urgencyFor(46)).toBe("later");
  });
});

describe("urgencyLabel", () => {
  it("only labels items that need attention", () => {
    expect(urgencyLabel("overdue", -3)).toBe("Date passed");
    expect(urgencyLabel("soon", 0)).toBe("Book now · today");
    expect(urgencyLabel("soon", 1)).toBe("Book now · tomorrow");
    expect(urgencyLabel("soon", 9)).toBe("Book now · in 9 days");
    expect(urgencyLabel("upcoming", 30)).toBe("Coming up · in 4 weeks");
    expect(urgencyLabel("later", 100)).toBeNull();
    expect(urgencyLabel("undated", null)).toBeNull();
    expect(urgencyLabel("soon", 3, "Buy")).toBe("Buy now · in 3 days");
  });
});

describe("nextStatusOnTap", () => {
  it("books to-book items and un-books everything else", () => {
    expect(nextStatusOnTap("TO_BOOK", false)).toBe("BOOKED");
    expect(nextStatusOnTap("BOOKED", false)).toBe("TO_BOOK");
    expect(nextStatusOnTap("NOT_NEEDED", false)).toBe("TO_BOOK");
  });

  it("buys gear to buy, and puts everything else back to buy", () => {
    expect(nextStatusOnTap("TO_BUY", true)).toBe("BOUGHT");
    expect(nextStatusOnTap("HAVE", true)).toBe("TO_BUY");
    expect(nextStatusOnTap(null, true)).toBe("TO_BUY");
  });
});

describe("nextPaymentOnTap", () => {
  it("marks unpaid things paid, and paid things back to pay", () => {
    expect(nextPaymentOnTap("TO_PAY")).toBe("PAID");
    expect(nextPaymentOnTap("PAY_ON_ARRIVAL")).toBe("PAID");
    expect(nextPaymentOnTap(null)).toBe("PAID");
    expect(nextPaymentOnTap("PAID")).toBe("TO_PAY");
  });
});

describe("countStatuses", () => {
  it("counts each status and skips items without one", () => {
    expect(countStatuses([item("a", "BOOKED", null), item("b", "BOOKED", null), item("c", "TO_BOOK", null), item("d", null, null)])).toMatchObject({
      BOOKED: 2,
      TO_BOOK: 1,
      NOT_NEEDED: 0,
    });
  });
});

describe("payment view", () => {
  const priced = (id: string, status: ItemStatus | null, payment: "PAID" | "PAY_ON_ARRIVAL" | "TO_PAY" | null, cost: number | null) => ({
    ...item(id, status, null),
    payment,
    cost,
  });

  it("groups by payment, counting bought gear as paid and leaving out free and no-status items", () => {
    const items = [
      priced("hostel", "BOOKED", "PAY_ON_ARRIVAL", 60),
      priced("flight", "BOOKED", "PAID", 640),
      priced("tour", "TO_BOOK", null, 45),
      priced("jacket", "BOUGHT", null, 90),
      priced("poles", "TO_BUY", null, 40),
      priced("temple", "NOT_NEEDED", null, null),
      priced("park", "TO_BOOK", null, 0),
      priced("visa", null, null, 35),
    ];
    const { groups } = build(items, stops, "2027-01-01", PAYMENT_ORDER, paymentGroupOf);
    expect(Object.fromEntries(PAYMENT_ORDER.map((k) => [k, groups[k].map((e) => e.item.id)]))).toEqual({
      TO_PAY: ["poles"],
      PAY_ON_ARRIVAL: ["hostel"],
      PAID: ["flight", "jacket"],
      UNSET: ["tour"],
    });
  });
});

describe("buildChecklist", () => {
  it("groups by status and sorts by date, falling back to the stop's arrival", () => {
    const items = [
      item("hostel", "TO_BOOK", "cnx"), // undated item → stop arrival 5 Feb
      item("flight", "TO_BOOK", "bkk", "2027-02-04T18:40:00.000Z"),
      item("insurance", "TO_BOOK", null), // trip-wide, undated
      item("hotel", "BOOKED", "bkk", "2027-02-01T15:00:00.000Z"),
    ];
    const { groups } = buildChecklist(items, stops, "2027-01-28");
    expect(groups.TO_BOOK.map((e) => e.item.id)).toEqual(["flight", "hostel", "insurance"]);
    expect(groups.TO_BOOK.map((e) => e.date)).toEqual(["2027-02-04", "2027-02-05", null]);
    expect(groups.TO_BOOK.map((e) => e.stopName)).toEqual(["Bangkok", "Chiang Mai", null]);
    expect(groups.BOOKED.map((e) => e.item.id)).toEqual(["hotel"]);
    expect(groups.BOOKED[0].urgency).toBeNull();
  });

  it("puts gear in its own sections and flags gear still to buy", () => {
    const items = [item("poles", "TO_BUY", "bkk"), item("jacket", "HAVE", null), item("visa", null, null)];
    const { groups, dueSoon } = buildChecklist(items, stops, "2027-01-28");
    expect(groups.TO_BUY.map((e) => [e.item.id, e.urgency])).toEqual([["poles", "soon"]]);
    expect(groups.HAVE.map((e) => e.item.id)).toEqual(["jacket"]);
    expect(groups.NONE.map((e) => e.item.id)).toEqual(["visa"]);
    expect(dueSoon).toBe(1);
  });

  it("flags to-book items that are soon or overdue", () => {
    const items = [
      item("past", "TO_BOOK", null, "2027-01-20T10:00:00.000Z"),
      item("soon", "TO_BOOK", "bkk"),
      item("later", "TO_BOOK", null, "2027-06-01T00:00:00.000Z"),
      item("booked-soon", "BOOKED", "bkk"),
    ];
    const list = buildChecklist(items, stops, "2027-01-28");
    expect(list.groups.TO_BOOK.map((e) => [e.item.id, e.urgency, e.daysUntil])).toEqual([
      ["past", "overdue", -8],
      ["soon", "soon", 4],
      ["later", "later", 124],
    ]);
    expect(list.dueSoon).toBe(1);
    expect(list.overdue).toBe(1);
  });

  it("keeps route order for items on the same day, and insertion order after that", () => {
    const items = [
      item("cnx-a", "TO_BOOK", "cnx", "2027-02-05T00:00:00.000Z"),
      item("bkk-a", "TO_BOOK", "bkk", "2027-02-05T00:00:00.000Z"),
      item("bkk-b", "TO_BOOK", "bkk", "2027-02-05T00:00:00.000Z"),
    ];
    const { groups } = buildChecklist(items, stops, "2027-01-01");
    expect(groups.TO_BOOK.map((e) => e.item.id)).toEqual(["bkk-a", "bkk-b", "cnx-a"]);
  });
});
