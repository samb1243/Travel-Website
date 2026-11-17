import { describe, expect, it } from "vitest";
import { bookingProgress } from "./status";

describe("bookingProgress", () => {
  it("counts pay-on-arrival as booked and ignores no-booking-needed items", () => {
    expect(bookingProgress({ BOOKED: 5, PAY_ON_ARRIVAL: 2, TO_BOOK: 3, NOT_NEEDED: 4 })).toEqual({
      booked: 7,
      total: 10,
      toBook: 3,
      percent: 70,
    });
  });

  it("handles trips with nothing to book", () => {
    expect(bookingProgress({ BOOKED: 0, PAY_ON_ARRIVAL: 0, TO_BOOK: 0, NOT_NEEDED: 2 }).percent).toBe(0);
  });
});
