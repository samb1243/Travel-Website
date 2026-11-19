import { describe, expect, it } from "vitest";
import { bookSoonEmail, dueBookingReminders, tripEveEmail, tripEveKey } from "./reminders";

const stops = [{ id: "cnx", name: "Chiang Mai", arriveOn: "2027-02-05" }];
const item = (id: string, startAt: string | null, status: "TO_BOOK" | "TO_BUY" | "BOOKED" = "TO_BOOK", stopId: string | null = null) => ({
  id,
  title: `Item ${id}`,
  status,
  startAt,
  stopId,
});

describe("dueBookingReminders", () => {
  it("reminds at 14 days, then again at 3, once each", () => {
    const items = [item("a", "2027-02-11T09:00:00.000Z")];
    // 15 days away: nothing yet
    expect(dueBookingReminders(items, stops, "2027-01-27", new Set())).toEqual([]);
    expect(dueBookingReminders(items, stops, "2027-01-28", new Set()).map((d) => [d.key, d.daysUntil])).toEqual([["book-soon:a:14", 14]]);
    // Sent already: nothing until it's 3 days away
    expect(dueBookingReminders(items, stops, "2027-02-01", new Set(["book-soon:a:14"]))).toEqual([]);
    expect(dueBookingReminders(items, stops, "2027-02-08", new Set(["book-soon:a:14"])).map((d) => d.key)).toEqual(["book-soon:a:3"]);
    expect(dueBookingReminders(items, stops, "2027-02-09", new Set(["book-soon:a:14", "book-soon:a:3"]))).toEqual([]);
  });

  it("uses the stop's arrival for undated items, and skips booked, undated and past ones", () => {
    const items = [
      item("stop-dated", null, "TO_BOOK", "cnx"),
      item("booked", "2027-02-03T00:00:00.000Z", "BOOKED"),
      item("no-date", null),
      item("past", "2027-01-20T00:00:00.000Z"),
      item("gear", "2027-02-02T00:00:00.000Z", "TO_BUY"),
    ];
    const due = dueBookingReminders(items, stops, "2027-01-30", new Set());
    expect(due.map((d) => [d.itemId, d.date, d.verb, d.stopName])).toEqual([
      ["gear", "2027-02-02", "buy", null],
      ["stop-dated", "2027-02-05", "book", "Chiang Mai"],
    ]);
  });

  it("an item added at 2 days away gets the 3-day reminder only", () => {
    expect(dueBookingReminders([item("late", "2027-02-01T00:00:00.000Z")], stops, "2027-01-30", new Set()).map((d) => d.key)).toEqual([
      "book-soon:late:3",
    ]);
  });
});

describe("tripEveKey", () => {
  it("is set only the day before the trip starts", () => {
    expect(tripEveKey("t1", "2027-05-01", "2027-04-30")).toBe("trip-eve:t1:2027-05-01");
    expect(tripEveKey("t1", "2027-05-01", "2027-04-29")).toBeNull();
    expect(tripEveKey("t1", "2027-05-01", "2027-05-01")).toBeNull();
    expect(tripEveKey("t1", null, "2027-04-30")).toBeNull();
  });
});

describe("emails", () => {
  const base = { name: "Maya", tripTitle: "Three weeks in Thailand", tripUrl: "https://tripster.example/trips/t1", unsubscribeUrl: "https://tripster.example/unsubscribe?x" };

  it("lists what's still to book, with when and where, and a way to stop them", () => {
    const due = dueBookingReminders([item("a", null, "TO_BOOK", "cnx")], stops, "2027-02-02", new Set());
    const e = bookSoonEmail({ ...base, due });
    expect(e.subject).toBe("1 thing to book soon: Three weeks in Thailand");
    expect(e.text).toContain("• Item a: in 3 days (Fri 5 Feb, Chiang Mai)");
    expect(e.text).toContain("https://tripster.example/trips/t1/checklist");
    expect(e.text).toContain("Stop reminder emails: https://tripster.example/unsubscribe?x");
  });

  it("says when things are to buy rather than book", () => {
    const due = dueBookingReminders([item("g", "2027-02-04T00:00:00.000Z", "TO_BUY")], stops, "2027-02-02", new Set());
    expect(bookSoonEmail({ ...base, due }).subject).toBe("1 thing to buy soon: Three weeks in Thailand");
  });

  it("the trip-eve email points at the plan and what's left", () => {
    const e = tripEveEmail({ ...base, firstStop: "Bangkok", stillToBook: 2 });
    expect(e.subject).toBe("Three weeks in Thailand starts tomorrow");
    expect(e.text).toContain("beginning in Bangkok");
    expect(e.text).toContain("2 things still to book or buy");
    expect(e.text).toContain("/itinerary");
  });
});
