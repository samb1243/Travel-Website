import { describe, expect, it } from "vitest";
import { bookingProgress, effectivePayment, emptyStatusCounts, statusesFor } from "./status";

describe("bookingProgress", () => {
  it("counts booked, bought and already-owned as sorted, and ignores no-booking-needed", () => {
    expect(bookingProgress({ ...emptyStatusCounts(), BOOKED: 5, BOUGHT: 1, HAVE: 1, TO_BOOK: 2, TO_BUY: 1, NOT_NEEDED: 4 })).toEqual({
      booked: 7,
      total: 10,
      toBook: 3,
      percent: 70,
    });
  });

  it("handles trips with nothing to book", () => {
    expect(bookingProgress({ ...emptyStatusCounts(), NOT_NEEDED: 2 }).percent).toBe(0);
  });
});

describe("statusesFor", () => {
  it("gives gear and other buying statuses, everything else booking statuses", () => {
    expect(statusesFor("GEAR")).toEqual(["BOUGHT", "TO_BUY", "HAVE"]);
    expect(statusesFor("OTHER")).toEqual(["BOUGHT", "TO_BUY", "HAVE"]);
    expect(statusesFor("ACCOMMODATION")).toEqual(["BOOKED", "TO_BOOK", "NOT_NEEDED"]);
  });
});

describe("effectivePayment", () => {
  it("uses the payment status when there is one", () => {
    expect(effectivePayment({ status: "BOOKED", payment: "PAY_ON_ARRIVAL" })).toBe("PAY_ON_ARRIVAL");
  });

  it("treats bought gear as paid and gear to buy as to pay", () => {
    expect(effectivePayment({ status: "BOUGHT", payment: null })).toBe("PAID");
    expect(effectivePayment({ status: "TO_BUY", payment: null })).toBe("TO_PAY");
    expect(effectivePayment({ status: null, payment: null })).toBeNull();
    expect(effectivePayment({ status: "BOOKED", payment: null })).toBeNull();
  });
});
