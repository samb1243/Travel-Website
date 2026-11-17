// Display helpers. Dates are calendar dates stored at 00:00 UTC, so always
// format in UTC to avoid showing the day before in western time zones.

import { daysBetween } from "@/lib/dates";

const LOCALE = "en-GB";

const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const weekdayDayMonth = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatDate(date: Date, opts?: { weekday?: boolean }) {
  return (opts?.weekday ? weekdayDayMonth : dayMonthYear).format(date);
}

/** "14–27 May 2027", "28 Mar – 8 Apr 2027", "30 Dec 2026 – 4 Jan 2027" */
export function formatDateRange(start: Date | null, end: Date | null): string | null {
  if (!start && !end) return null;
  if (!start || !end) return formatDate((start ?? end)!);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    if (start.getUTCDate() === end.getUTCDate()) return formatDate(start);
    return `${start.getUTCDate()}–${dayMonthYear.format(end)}`;
  }
  if (sameYear) return `${dayMonth.format(start)} – ${dayMonthYear.format(end)}`;
  return `${dayMonthYear.format(start)} – ${dayMonthYear.format(end)}`;
}

export type TripTiming =
  | { phase: "undated" }
  | { phase: "upcoming"; daysUntil: number }
  | { phase: "ongoing"; day: number; totalDays: number }
  | { phase: "past" };

export function tripTiming(start: Date | null, end: Date | null, today: Date): TripTiming {
  if (!start) return { phase: "undated" };
  const finish = end ?? start;
  if (daysBetween(today, start) > 0) return { phase: "upcoming", daysUntil: daysBetween(today, start) };
  if (daysBetween(today, finish) >= 0) {
    return { phase: "ongoing", day: daysBetween(start, today) + 1, totalDays: daysBetween(start, finish) + 1 };
  }
  return { phase: "past" };
}

export function timingLabel(timing: TripTiming): string | null {
  switch (timing.phase) {
    case "undated":
      return null;
    case "upcoming":
      if (timing.daysUntil === 1) return "Tomorrow";
      if (timing.daysUntil < 60) return `In ${timing.daysUntil} days`;
      return `In ${Math.round(timing.daysUntil / 30.4)} months`;
    case "ongoing":
      return `Day ${timing.day} of ${timing.totalDays}`;
    case "past":
      return "Done";
  }
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "TH" -> 🇹🇭 */
export function flagEmoji(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const clock = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/**
 * When an item happens, in local wall-clock time:
 * "Tue 4 Feb · 18:40 → Wed 5 Feb · 07:15", "Thu 6 Feb · 09:00–13:00", "Sat 1 Feb – Tue 4 Feb"
 */
export function formatItemWhen(startIso: string | null, endIso: string | null, allDay: boolean): string | null {
  if (!startIso) return null;
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const startDay = weekdayDayMonth.format(start);
  const endHasTime = end && (end.getUTCHours() !== 0 || end.getUTCMinutes() !== 0);

  if (allDay) {
    if (!end || daysBetween(start, end) === 0) return startDay;
    return `${startDay} – ${weekdayDayMonth.format(end)}${endHasTime ? ` · ${clock.format(end)}` : ""}`;
  }
  const startText = `${startDay} · ${clock.format(start)}`;
  if (!end) return startText;
  if (daysBetween(start, end) === 0) return `${startText}–${clock.format(end)}`;
  return `${startText} → ${weekdayDayMonth.format(end)}${endHasTime ? ` · ${clock.format(end)}` : ""}`;
}
