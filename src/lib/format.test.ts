import { describe, expect, it } from "vitest";
import { parseDateOnly as d } from "@/lib/dates";
import { flagEmoji, formatDateRange, formatItemWhen, timingLabel, tripTiming } from "./format";

describe("formatDateRange", () => {
  it("collapses the same month", () => {
    expect(formatDateRange(d("2027-05-14"), d("2027-05-27"))).toBe("14–27 May 2027");
  });
  it("shows both months in the same year", () => {
    expect(formatDateRange(d("2027-03-28"), d("2027-04-08"))).toBe("28 Mar – 8 Apr 2027");
  });
  it("shows both years across new year", () => {
    expect(formatDateRange(d("2026-12-30"), d("2027-01-04"))).toBe("30 Dec 2026 – 4 Jan 2027");
  });
  it("handles missing dates", () => {
    expect(formatDateRange(null, null)).toBeNull();
    expect(formatDateRange(d("2027-01-01"), null)).toBe("1 Jan 2027");
  });
});

describe("tripTiming", () => {
  const start = d("2027-05-14");
  const end = d("2027-05-27");
  it("counts down to upcoming trips", () => {
    expect(timingLabel(tripTiming(start, end, d("2027-05-13")))).toBe("Tomorrow");
    expect(timingLabel(tripTiming(start, end, d("2027-04-14")))).toBe("In 30 days");
  });
  it("shows the day number while travelling", () => {
    expect(timingLabel(tripTiming(start, end, d("2027-05-14")))).toBe("Day 1 of 14");
    expect(timingLabel(tripTiming(start, end, d("2027-05-27")))).toBe("Day 14 of 14");
  });
  it("marks finished trips", () => {
    expect(tripTiming(start, end, d("2027-05-28")).phase).toBe("past");
  });
});

describe("flagEmoji", () => {
  it("turns a country code into a flag", () => {
    expect(flagEmoji("th")).toBe("🇹🇭");
    expect(flagEmoji("nope")).toBe("");
  });
});


describe("formatItemWhen", () => {
  it("formats overnight transport", () => {
    expect(formatItemWhen("2027-02-04T18:40:00.000Z", "2027-02-05T07:15:00.000Z", false)).toBe(
      "Thu 4 Feb · 18:40 → Fri 5 Feb · 07:15",
    );
  });
  it("formats a same-day slot", () => {
    expect(formatItemWhen("2027-02-06T09:00:00.000Z", "2027-02-06T13:00:00.000Z", false)).toBe("Sat 6 Feb · 09:00–13:00");
  });
  it("formats all-day items and stays", () => {
    expect(formatItemWhen("2027-02-06T00:00:00.000Z", null, true)).toBe("Sat 6 Feb");
    expect(formatItemWhen("2027-02-01T00:00:00.000Z", "2027-02-04T00:00:00.000Z", true)).toBe("Mon 1 Feb – Thu 4 Feb");
  });
  it("returns null without a date", () => {
    expect(formatItemWhen(null, null, false)).toBeNull();
  });
});
