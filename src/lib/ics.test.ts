import { describe, expect, it } from "vitest";
import { escapeText, floatingDateTime, foldLine, tripToIcs, type CalendarInput, type CalendarItem } from "./ics";

const item = (over: Partial<CalendarItem>): CalendarItem => ({
  id: "i1",
  category: "ACTIVITY",
  title: "Cooking class",
  provider: null,
  startAt: null,
  endAt: null,
  allDay: false,
  fromPlace: null,
  toPlace: null,
  status: "BOOKED",
  payment: "PAID",
  address: null,
  confirmationCode: null,
  notes: null,
  links: [],
  stopName: "Chiang Mai",
  ...over,
});

const input = (over: Partial<CalendarInput> = {}): CalendarInput => ({
  tripId: "t1",
  title: "Three weeks in Thailand, Laos & Vietnam",
  description: null,
  stops: [],
  items: [],
  generatedAt: new Date("2026-11-18T12:00:00Z"),
  tripUrl: "https://tripster.example/trips/t1",
  ...over,
});

/** Unfolds lines and splits into a list, the way calendar apps read the file. */
const lines = (ics: string) => ics.replace(/\r\n /g, "").split("\r\n");
const event = (ics: string, uid: string) => {
  const all = lines(ics);
  const start = all.indexOf(`UID:${uid}`);
  return all.slice(start, all.indexOf("END:VEVENT", start));
};

describe("escapeText", () => {
  it("escapes the characters iCalendar treats specially", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Hi")).toBe("SUMMARY:Hi");
  });

  it("folds at 75 bytes without splitting multi-byte characters", () => {
    const folded = foldLine(`SUMMARY:${"é".repeat(100)}`);
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
      expect(part).not.toContain("�");
    }
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é".repeat(100)}`);
  });
});

describe("floatingDateTime", () => {
  it("writes the wall-clock time with no time zone", () => {
    expect(floatingDateTime("2027-02-04T18:40:00.000Z")).toBe("20270204T184000");
  });
});

describe("tripToIcs", () => {
  it("is a valid calendar with CRLF line endings", () => {
    const ics = tripToIcs(input());
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines(ics)).toContain("X-WR-CALNAME:Three weeks in Thailand\\, Laos & Vietnam");
  });

  it("writes timed bookings as floating local times", () => {
    const ics = tripToIcs(
      input({
        items: [
          item({
            id: "train",
            category: "TRANSPORT",
            title: "Sleeper train",
            startAt: "2027-02-04T18:40:00.000Z",
            endAt: "2027-02-05T07:15:00.000Z",
            fromPlace: "Bangkok",
            toPlace: "Chiang Mai",
            confirmationCode: "12GO-55",
            provider: "SRT",
          }),
        ],
      }),
    );
    const e = event(ics, "item-train@tripster");
    expect(e).toContain("DTSTART:20270204T184000");
    expect(e).toContain("DTEND:20270205T071500");
    expect(e).toContain("SUMMARY:🚆 Sleeper train");
    expect(e).toContain("LOCATION:Bangkok → Chiang Mai");
    expect(e.find((l) => l.startsWith("DESCRIPTION:"))).toContain("Confirmation: 12GO-55");
  });

  it("gives timed bookings without an end an hour", () => {
    const ics = tripToIcs(input({ items: [item({ id: "a", startAt: "2027-02-07T09:00:00.000Z" })] }));
    expect(event(ics, "item-a@tripster")).toContain("DURATION:PT1H");
  });

  it("writes all-day bookings with an exclusive end date", () => {
    const ics = tripToIcs(
      input({
        items: [
          item({ id: "hike", startAt: "2027-07-04T00:00:00.000Z", allDay: true }),
          item({ id: "pass", startAt: "2027-05-14T00:00:00.000Z", endAt: "2027-05-27T00:00:00.000Z", allDay: true }),
        ],
      }),
    );
    expect(event(ics, "item-hike@tripster")).toEqual(
      expect.arrayContaining(["DTSTART;VALUE=DATE:20270704", "DTEND;VALUE=DATE:20270705"]),
    );
    expect(event(ics, "item-pass@tripster")).toEqual(
      expect.arrayContaining(["DTSTART;VALUE=DATE:20270514", "DTEND;VALUE=DATE:20270528"]),
    );
  });

  it("adds stops as all-day events and skips undated bookings", () => {
    const ics = tripToIcs(
      input({
        stops: [{ id: "bkk", name: "Bangkok", country: "Thailand", arriveOn: "2027-02-01", departOn: "2027-02-04" }],
        items: [item({ id: "undated" })],
      }),
    );
    const e = event(ics, "stop-bkk@tripster");
    expect(e).toEqual(
      expect.arrayContaining([
        "DTSTART;VALUE=DATE:20270201",
        "DTEND;VALUE=DATE:20270205",
        "SUMMARY:📍 Bangkok (stop 1)",
        "TRANSP:TRANSPARENT",
      ]),
    );
    expect(ics).not.toContain("item-undated");
  });

  it("keeps the same event ids every time, so calendars update instead of duplicating", () => {
    const a = tripToIcs(input({ items: [item({ id: "x", startAt: "2027-02-07T09:00:00.000Z" })] }));
    const b = tripToIcs(input({ items: [item({ id: "x", startAt: "2027-02-08T10:00:00.000Z" })], generatedAt: new Date() }));
    expect(lines(a)).toContain("UID:item-x@tripster");
    expect(lines(b)).toContain("UID:item-x@tripster");
  });
});
