// Checklist logic: groups a trip's items by booking status and works out which
// "to book" items need attention soon. Pure functions so they're unit-tested.

import { daysBetween, parseDateOnly } from "@/lib/dates";
import type { ItemStatus } from "@/lib/status";

/** Section order on the checklist: what still needs doing first. */
export const CHECKLIST_ORDER: readonly ItemStatus[] = ["TO_BOOK", "PAY_ON_ARRIVAL", "BOOKED", "NOT_NEEDED"];

/** Within this many days a to-book item is flagged "Book now". */
export const SOON_DAYS = 14;
/** Within this many days it's flagged "Coming up". */
export const UPCOMING_DAYS = 45;

export type Urgency = "overdue" | "soon" | "upcoming" | "later" | "undated";

type ItemLike = { id: string; stopId: string | null; startAt: string | null; status: ItemStatus };
type StopLike = { id: string; name: string; arriveOn: string | null };

export type ChecklistEntry<T> = {
  item: T;
  /** "YYYY-MM-DD": the item's own date, or its stop's arrival date */
  date: string | null;
  daysUntil: number | null;
  stopName: string | null;
  /** Only set for TO_BOOK items */
  urgency: Urgency | null;
};

export type Checklist<T> = {
  groups: Record<ItemStatus, ChecklistEntry<T>[]>;
  /** TO_BOOK items due within SOON_DAYS */
  dueSoon: number;
  /** TO_BOOK items whose date has already passed */
  overdue: number;
};

export function urgencyFor(daysUntil: number | null): Urgency {
  if (daysUntil === null) return "undated";
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= SOON_DAYS) return "soon";
  if (daysUntil <= UPCOMING_DAYS) return "upcoming";
  return "later";
}

/** Badge text for a to-book item, or null when it doesn't need flagging. */
export function urgencyLabel(urgency: Urgency, daysUntil: number | null): string | null {
  switch (urgency) {
    case "overdue":
      return "Date passed";
    case "soon":
      if (daysUntil === 0) return "Book now · today";
      if (daysUntil === 1) return "Book now · tomorrow";
      return `Book now · in ${daysUntil} days`;
    case "upcoming":
      return `Coming up · in ${Math.round(daysUntil! / 7)} weeks`;
    default:
      return null;
  }
}

/** The one-tap action: anything not yet booked becomes Booked; anything else goes back to To book. */
export function nextStatusOnTap(status: ItemStatus): ItemStatus {
  return status === "TO_BOOK" ? "BOOKED" : "TO_BOOK";
}

/** Counts per status, e.g. for the progress bar while a change is in flight. */
export function countStatuses(items: { status: ItemStatus }[]): Record<ItemStatus, number> {
  const counts: Record<ItemStatus, number> = { BOOKED: 0, PAY_ON_ARRIVAL: 0, TO_BOOK: 0, NOT_NEEDED: 0 };
  for (const i of items) counts[i.status]++;
  return counts;
}

/**
 * Groups items by status. Each group is sorted by date (undated last), then by
 * route order, keeping the incoming order for ties. `today` is "YYYY-MM-DD".
 */
export function buildChecklist<T extends ItemLike>(items: T[], stops: StopLike[], today: string): Checklist<T> {
  const todayDate = parseDateOnly(today);
  const stopIndex = new Map(stops.map((s, i) => [s.id, i]));
  const stopById = new Map(stops.map((s) => [s.id, s]));

  const entries = items.map((item, order) => {
    const stop = item.stopId ? stopById.get(item.stopId) : undefined;
    const date = item.startAt ? item.startAt.slice(0, 10) : (stop?.arriveOn ?? null);
    const daysUntil = date ? daysBetween(todayDate, parseDateOnly(date)) : null;
    const entry: ChecklistEntry<T> = {
      item,
      date,
      daysUntil,
      stopName: stop?.name ?? null,
      urgency: item.status === "TO_BOOK" ? urgencyFor(daysUntil) : null,
    };
    // Trip-wide items sort after the stops when undated.
    return { entry, order, routeIndex: item.stopId ? (stopIndex.get(item.stopId) ?? stops.length) : stops.length };
  });

  entries.sort((a, b) => {
    const da = a.entry.date;
    const db = b.entry.date;
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da < db ? -1 : 1;
    }
    return a.routeIndex - b.routeIndex || a.order - b.order;
  });

  const groups: Record<ItemStatus, ChecklistEntry<T>[]> = { TO_BOOK: [], PAY_ON_ARRIVAL: [], BOOKED: [], NOT_NEEDED: [] };
  for (const { entry } of entries) groups[entry.item.status].push(entry);

  const dueSoon = groups.TO_BOOK.filter((e) => e.urgency === "soon").length;
  const overdue = groups.TO_BOOK.filter((e) => e.urgency === "overdue").length;
  return { groups, dueSoon, overdue };
}
