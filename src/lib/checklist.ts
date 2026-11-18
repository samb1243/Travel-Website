// Checklist logic: groups a trip's items by status (bookings and buying) or by
// payment, and works out which "to book" / "to buy" items need attention soon.
// Pure functions so they're unit-tested.

import { daysBetween, parseDateOnly } from "@/lib/dates";
import { effectivePayment, emptyStatusCounts, isOpen, type ItemStatus, type PaymentStatus, type StatusCounts } from "@/lib/status";

/** The two ways to look at the checklist */
export type ChecklistView = "booking" | "payment";

/** Booking view sections: what still needs doing first. NONE = gear/other with no status. */
export type BookingGroup = ItemStatus | "NONE";
export const BOOKING_ORDER: readonly BookingGroup[] = ["TO_BOOK", "TO_BUY", "BOOKED", "BOUGHT", "HAVE", "NOT_NEEDED", "NONE"];

/** Payment view sections. UNSET = has a price, but nobody said how it's paid. */
export type PaymentGroup = PaymentStatus | "UNSET";
export const PAYMENT_ORDER: readonly PaymentGroup[] = ["TO_PAY", "PAY_ON_ARRIVAL", "PAID", "UNSET"];

/** Which booking-view section an item goes in */
export const bookingGroupOf = (i: { status: ItemStatus | null }): BookingGroup => i.status ?? "NONE";

/** Which payment-view section an item goes in, or null to leave it out (free, or nothing to pay) */
export function paymentGroupOf(i: { status: ItemStatus | null; payment: PaymentStatus | null; cost: number | null }): PaymentGroup | null {
  const p = effectivePayment(i);
  if (p) return p;
  if (i.cost === 0 || i.status === "NOT_NEEDED" || i.status === null) return null;
  return "UNSET";
}

/** Within this many days a to-book item is flagged "Book now". */
export const SOON_DAYS = 14;
/** Within this many days it's flagged "Coming up". */
export const UPCOMING_DAYS = 45;

export type Urgency = "overdue" | "soon" | "upcoming" | "later" | "undated";

type ItemLike = { id: string; stopId: string | null; startAt: string | null; status: ItemStatus | null };
type StopLike = { id: string; name: string; arriveOn: string | null };

export type ChecklistEntry<T> = {
  item: T;
  /** "YYYY-MM-DD": the item's own date, or its stop's arrival date */
  date: string | null;
  daysUntil: number | null;
  stopName: string | null;
  /** Only set for items still to book or buy */
  urgency: Urgency | null;
};

export type Checklist<T, K extends string> = {
  groups: Record<K, ChecklistEntry<T>[]>;
  /** Items still to book or buy, due within SOON_DAYS */
  dueSoon: number;
  /** Items still to book or buy whose date has already passed */
  overdue: number;
};

export function urgencyFor(daysUntil: number | null): Urgency {
  if (daysUntil === null) return "undated";
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= SOON_DAYS) return "soon";
  if (daysUntil <= UPCOMING_DAYS) return "upcoming";
  return "later";
}

/** Badge text for an item still to book or buy, or null when it doesn't need flagging. */
export function urgencyLabel(urgency: Urgency, daysUntil: number | null, verb: "Book" | "Buy" = "Book"): string | null {
  switch (urgency) {
    case "overdue":
      return "Date passed";
    case "soon":
      if (daysUntil === 0) return `${verb} now · today`;
      if (daysUntil === 1) return `${verb} now · tomorrow`;
      return `${verb} now · in ${daysUntil} days`;
    case "upcoming":
      return `Coming up · in ${Math.round(daysUntil! / 7)} weeks`;
    default:
      return null;
  }
}

/** The one-tap action: to book → booked, to buy → bought; anything else goes back to to book / to buy. */
export function nextStatusOnTap(status: ItemStatus | null, purchase: boolean): ItemStatus {
  if (purchase) return status === "TO_BUY" ? "BOUGHT" : "TO_BUY";
  return status === "TO_BOOK" ? "BOOKED" : "TO_BOOK";
}

/** The one-tap payment action: paid <-> to pay (pay on arrival also becomes paid). */
export function nextPaymentOnTap(payment: PaymentStatus | null): PaymentStatus {
  return payment === "PAID" ? "TO_PAY" : "PAID";
}

/** Counts per status, e.g. for the progress bar while a change is in flight. */
export function countStatuses(items: { status: ItemStatus | null }[]): StatusCounts {
  const counts = emptyStatusCounts();
  for (const i of items) if (i.status) counts[i.status]++;
  return counts;
}

/**
 * Groups items into sections (`groupOf` returns null to leave an item out).
 * Each section is sorted by date (undated last), then by route order, keeping
 * the incoming order for ties. `today` is "YYYY-MM-DD".
 */
export function buildChecklist<T extends ItemLike, K extends string>(
  items: T[],
  stops: StopLike[],
  today: string,
  order: readonly K[],
  groupOf: (item: T) => K | null,
): Checklist<T, K> {
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
      urgency: isOpen(item.status) ? urgencyFor(daysUntil) : null,
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

  const groups = Object.fromEntries(order.map((k) => [k, [] as ChecklistEntry<T>[]])) as Record<K, ChecklistEntry<T>[]>;
  for (const { entry } of entries) {
    const key = groupOf(entry.item);
    if (key !== null) groups[key]?.push(entry);
  }

  const open = entries.map((e) => e.entry).filter((e) => isOpen(e.item.status));
  const dueSoon = open.filter((e) => e.urgency === "soon").length;
  const overdue = open.filter((e) => e.urgency === "overdue").length;
  return { groups, dueSoon, overdue };
}
