// Reminder emails: which bookings are due a "still to book" reminder, when a
// trip is about to start, and the email text. Pure functions (unit-tested);
// sending and the daily run are in src/server/reminders.ts.

import { daysBetween, parseDateOnly } from "@/lib/dates";
import { formatDate, plural } from "@/lib/format";
import type { ItemStatus } from "@/lib/status";

/** Remind about things still to book or buy when they're this many days away (each once) */
export const REMIND_AT_DAYS = [14, 3] as const;

type ItemLike = { id: string; title: string; status: ItemStatus | null; startAt: string | null; stopId: string | null };
type StopLike = { id: string; name: string; arriveOn: string | null };

export type DueReminder = {
  itemId: string;
  title: string;
  /** "YYYY-MM-DD": the item's own date, or its stop's arrival */
  date: string;
  daysUntil: number;
  verb: "book" | "buy";
  stopName: string | null;
  /** Log key, so it's only ever sent once: "book-soon:<itemId>:<threshold>" */
  key: string;
};

/**
 * Items still to book or buy that just came within a reminder threshold and
 * weren't reminded about at that threshold yet. Past dates are left alone.
 */
export function dueBookingReminders(items: ItemLike[], stops: StopLike[], today: string, sent: Set<string>): DueReminder[] {
  const stopById = new Map(stops.map((s) => [s.id, s]));
  const todayDate = parseDateOnly(today);
  const due: DueReminder[] = [];
  for (const item of items) {
    if (item.status !== "TO_BOOK" && item.status !== "TO_BUY") continue;
    const stop = item.stopId ? stopById.get(item.stopId) : undefined;
    const date = item.startAt ? item.startAt.slice(0, 10) : (stop?.arriveOn ?? null);
    if (!date) continue;
    const daysUntil = daysBetween(todayDate, parseDateOnly(date));
    if (daysUntil < 0) continue;
    // The tightest threshold it's within: 10 days away → the 14-day reminder; 2 → the 3-day one
    const threshold = [...REMIND_AT_DAYS].sort((a, b) => a - b).find((t) => daysUntil <= t);
    if (threshold === undefined) continue;
    const key = `book-soon:${item.id}:${threshold}`;
    if (sent.has(key)) continue;
    due.push({ itemId: item.id, title: item.title, date, daysUntil, verb: item.status === "TO_BUY" ? "buy" : "book", stopName: stop?.name ?? null, key });
  }
  return due.sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title));
}

/** The trip-eve email's log key, when the trip starts tomorrow; null otherwise. */
export function tripEveKey(tripId: string, startDate: string | null, today: string): string | null {
  if (!startDate) return null;
  return daysBetween(parseDateOnly(today), parseDateOnly(startDate)) === 1 ? `trip-eve:${tripId}:${startDate}` : null;
}

const when = (daysUntil: number) => (daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`);

export type EmailText = { subject: string; text: string };

const footer = (unsubscribeUrl: string) =>
  ["", "—", "You get these because you're planning this trip on Tripster.", `Stop reminder emails: ${unsubscribeUrl}`].join("\n");

export function bookSoonEmail(p: { name: string; tripTitle: string; tripUrl: string; unsubscribeUrl: string; due: DueReminder[] }): EmailText {
  const books = p.due.filter((d) => d.verb === "book").length;
  const buys = p.due.length - books;
  const what = books && buys ? plural(p.due.length, "thing") + " to book or buy" : buys ? `${plural(buys, "thing")} to buy` : `${plural(books, "thing")} to book`;
  return {
    subject: `${what[0].toUpperCase()}${what.slice(1)} soon: ${p.tripTitle}`,
    text: [
      `Hi ${p.name},`,
      "",
      `Coming up on ${p.tripTitle}, still to ${books && buys ? "book or buy" : buys ? "buy" : "book"}:`,
      "",
      ...p.due.map((d) => `• ${d.title}: ${when(d.daysUntil)} (${formatDate(parseDateOnly(d.date), { weekday: true })}${d.stopName ? `, ${d.stopName}` : ""})`),
      "",
      `Open the checklist: ${p.tripUrl}/checklist`,
      footer(p.unsubscribeUrl),
    ].join("\n"),
  };
}

export function tripEveEmail(p: {
  name: string;
  tripTitle: string;
  tripUrl: string;
  unsubscribeUrl: string;
  firstStop: string | null;
  stillToBook: number;
}): EmailText {
  return {
    subject: `${p.tripTitle} starts tomorrow`,
    text: [
      `Hi ${p.name},`,
      "",
      `${p.tripTitle} starts tomorrow${p.firstStop ? `, beginning in ${p.firstStop}` : ""}. Have a great trip!`,
      "",
      p.stillToBook ? `${plural(p.stillToBook, "thing")} still to book or buy: ${p.tripUrl}/checklist` : "Everything's booked.",
      `Your day-by-day plan: ${p.tripUrl}/itinerary`,
      "",
      "Tip: open the trip in Tripster on your phone before you go, so it's saved for when there's no signal.",
      footer(p.unsubscribeUrl),
    ].join("\n"),
  };
}
