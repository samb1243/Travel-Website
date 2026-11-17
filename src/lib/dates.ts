// Trip dates are calendar dates and item times are local wall-clock times.
// Both are stored without a time zone and handled in UTC everywhere, so a
// "07:40 in Bangkok" never shifts to the viewer's time zone.

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2027-03-01" -> Date at 00:00 UTC */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date -> "2027-03-01" */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole calendar days from a to b (b - a), ignoring time of day. */
export function daysBetween(a: Date, b: Date): number {
  const start = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((end - start) / DAY_MS);
}

/** Wall-clock time on a given date, e.g. atTime(date, "07:40") */
export function atTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m),
  );
}
