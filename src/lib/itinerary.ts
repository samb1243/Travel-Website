// Day-by-day itinerary. Pure functions (unit-tested) that turn a trip's stops
// and items into a list of days.
//
// - Every day between the trip's start and end gets a card, even empty ones.
//   Without trip dates, the range comes from the stops and items.
// - Dated items outside that range (e.g. "buy a rain jacket" weeks before)
//   get their own day cards, but the empty days around them don't.
// - Stays, flights and buses/trains that end on a later day appear twice:
//   on the start day (Check-in / Departs) and on the end day (Check-out / Arrives).
//   Other multi-day items (a rail pass, insurance) appear on their first day only.
// - Each night records where you sleep: a stay, an overnight journey, or nothing yet.

import { addDays, daysBetween, parseDateOnly, toDateOnly } from "@/lib/dates";
import type { ItemCategory } from "@/generated/prisma/enums";

/** Longest range of consecutive days we'll draw. */
export const MAX_DAYS = 400;

const SPLIT_CATEGORIES: ReadonlySet<ItemCategory> = new Set(["ACCOMMODATION", "FLIGHT", "TRANSPORT"]);
const OVERNIGHT_CATEGORIES: ReadonlySet<ItemCategory> = new Set(["FLIGHT", "TRANSPORT"]);

type ItemLike = {
  id: string;
  stopId: string | null;
  category: ItemCategory;
  /** Wall-clock ISO string */
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
};
type StopLike = { id: string; name: string; arriveOn: string | null; departOn: string | null };

export type EntryKind = "single" | "start" | "end";

export type DayEntry<T> = {
  item: T;
  kind: EntryKind;
  /** "HH:MM" of the moment this entry is about, or null for all-day / no time */
  time: string | null;
};

export type Night<T> = { kind: "stay"; item: T } | { kind: "travel"; item: T } | { kind: "none" };

export type ItineraryDay<T> = {
  /** "YYYY-MM-DD" */
  date: string;
  /** 1-based day of the trip, or null for days before/after the trip's dates */
  dayNumber: number | null;
  /** Stops you're at that day, in route order (two on a travel day) */
  places: { id: string; name: string }[];
  entries: DayEntry<T>[];
  /** Where you sleep that night; null on the last day and outside the trip */
  night: Night<T> | null;
};

export type Itinerary<T> = {
  days: ItineraryDay<T>[];
  /** Items with no date yet, grouped by stop (route order), trip-wide items last */
  unscheduled: { stopId: string | null; stopName: string | null; items: T[] }[];
  /** True when the range had to be cut at MAX_DAYS */
  truncated: boolean;
};

const dateOf = (iso: string) => iso.slice(0, 10);

/** "HH:MM", or null when the item is all-day or has no time (stored as 00:00). */
export function timeOf(iso: string | null, allDay: boolean): string | null {
  if (!iso || allDay) return null;
  const t = iso.slice(11, 16);
  return t === "00:00" ? null : t;
}

function spanOf(item: ItemLike) {
  if (!item.startAt) return null;
  const start = dateOf(item.startAt);
  const end = item.endAt ? dateOf(item.endAt) : start;
  return { start, end: end < start ? start : end };
}

export function buildItinerary<T extends ItemLike>(
  items: T[],
  stops: StopLike[],
  trip: { startDate: string | null; endDate: string | null },
): Itinerary<T> {
  // --- Which days to draw ------------------------------------------------------
  const knownDates: string[] = [];
  for (const s of stops) {
    if (s.arriveOn) knownDates.push(s.arriveOn);
    if (s.departOn) knownDates.push(s.departOn);
  }
  for (const i of items) {
    const span = spanOf(i);
    if (span) knownDates.push(span.start, span.end);
  }
  knownDates.sort();

  const rangeStart = trip.startDate ?? knownDates[0] ?? null;
  const rangeEnd = trip.endDate ?? trip.startDate ?? knownDates.at(-1) ?? null;
  const tripStart = trip.startDate ?? rangeStart;
  const tripEnd = trip.endDate ?? rangeEnd;

  const dayDates = new Set<string>();
  let truncated = false;
  if (rangeStart && rangeEnd) {
    const first = parseDateOnly(rangeStart);
    const count = daysBetween(first, parseDateOnly(rangeEnd)) + 1;
    truncated = count > MAX_DAYS;
    for (let d = 0; d < Math.min(count, MAX_DAYS); d++) dayDates.add(toDateOnly(addDays(first, d)));
  }

  // --- Entries per day -----------------------------------------------------------
  type Sortable = DayEntry<T> & { order: number };
  const entriesByDay = new Map<string, Sortable[]>();
  const add = (date: string, entry: Sortable) => {
    if (!entriesByDay.has(date)) entriesByDay.set(date, []);
    entriesByDay.get(date)!.push(entry);
  };

  items.forEach((item, order) => {
    const span = spanOf(item);
    if (!span) return;
    const multiDay = span.end !== span.start;
    if (multiDay && SPLIT_CATEGORIES.has(item.category)) {
      add(span.start, { item, kind: "start", time: timeOf(item.startAt, item.allDay), order });
      add(span.end, { item, kind: "end", time: timeOf(item.endAt, item.allDay), order });
    } else {
      add(span.start, { item, kind: "single", time: timeOf(item.startAt, item.allDay), order });
    }
  });

  // Dated items outside the drawn range still get a (sparse) day card.
  if (!truncated) for (const date of entriesByDay.keys()) dayDates.add(date);

  // --- Nights --------------------------------------------------------------------
  function nightOf(date: string): Night<T> {
    let travel: T | null = null;
    for (const item of items) {
      const span = spanOf(item);
      if (!span || !(span.start <= date && date < span.end)) continue;
      if (item.category === "ACCOMMODATION") return { kind: "stay", item };
      if (OVERNIGHT_CATEGORIES.has(item.category)) travel ??= item;
    }
    return travel ? { kind: "travel", item: travel } : { kind: "none" };
  }

  const datedStops = stops.filter((s) => s.arriveOn);

  const days = [...dayDates].sort().map((date): ItineraryDay<T> => {
    const inTrip = tripStart !== null && tripEnd !== null && tripStart <= date && date <= tripEnd;
    const entries = (entriesByDay.get(date) ?? [])
      .sort((a, b) => {
        if (a.time !== b.time) {
          if (a.time === null) return -1;
          if (b.time === null) return 1;
          return a.time < b.time ? -1 : 1;
        }
        return a.order - b.order;
      })
      .map(({ item, kind, time }) => ({ item, kind, time }));

    return {
      date,
      dayNumber: inTrip ? daysBetween(parseDateOnly(tripStart!), parseDateOnly(date)) + 1 : null,
      places: datedStops
        .filter((s) => s.arriveOn! <= date && date <= (s.departOn ?? s.arriveOn!))
        .map((s) => ({ id: s.id, name: s.name })),
      entries,
      night: inTrip && date !== tripEnd ? nightOf(date) : null,
    };
  });

  // --- Not scheduled yet -------------------------------------------------------------
  const undated = items.filter((i) => !i.startAt);
  const unscheduled: Itinerary<T>["unscheduled"] = [];
  for (const s of stops) {
    const list = undated.filter((i) => i.stopId === s.id);
    if (list.length) unscheduled.push({ stopId: s.id, stopName: s.name, items: list });
  }
  const stopIds = new Set(stops.map((s) => s.id));
  const tripWide = undated.filter((i) => !i.stopId || !stopIds.has(i.stopId));
  if (tripWide.length) unscheduled.push({ stopId: null, stopName: null, items: tripWide });

  return { days, unscheduled, truncated };
}
