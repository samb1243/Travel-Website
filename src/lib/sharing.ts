// Sharing rules, kept pure so they're unit-tested:
// - who can see a trip
// - what a shared copy of an item looks like (personal details removed)
// - how "Copy this trip" builds the new trip
//
// Personal details, never shown to anyone but the owner and never copied:
//   Item.confirmationCode, Item.privateNotes, and links of kind CONFIRMATION.

import { addDays, daysBetween } from "@/lib/dates";
import type { ItemCategory, ItemStatus, LinkKind, TripType, Visibility } from "@/generated/prisma/enums";

export const SHAREABLE: readonly Visibility[] = ["PUBLIC", "UNLISTED"];

/** Owner and members always; anyone else only for public or unlisted trips. */
export function canViewTrip(
  trip: { visibility: Visibility; ownerId: string; memberIds?: readonly string[] },
  viewerId: string | null,
): boolean {
  if (viewerId !== null && (trip.ownerId === viewerId || trip.memberIds?.includes(viewerId))) return true;
  return SHAREABLE.includes(trip.visibility);
}

type LinkLike = { kind: LinkKind };

/** Links others may see: everything except personal confirmation links. */
export function shareableLinks<T extends LinkLike>(links: T[]): T[] {
  return links.filter((l) => l.kind !== "CONFIRMATION");
}

/** Removes personal details from an item. Works whether or not they were loaded. */
export function stripPersonal<T extends { links: LinkLike[] }>(
  item: T,
): Omit<T, "confirmationCode" | "privateNotes"> & { confirmationCode: null; privateNotes: null } {
  return { ...item, confirmationCode: null, privateNotes: null, links: shareableLinks(item.links) };
}

// --- Copy this trip ---------------------------------------------------------------

/** The source as loaded by the shared-trip query (no personal fields selected). */
export type CopySource = {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  types: TripType[];
  description: string | null;
  coverImageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  currency: string;
  budget: number | null;
  travellers: number;
  stops: {
    id: string;
    position: number;
    name: string;
    region: string | null;
    country: string | null;
    countryCode: string | null;
    placeId: string | null;
    lat: number | null;
    lng: number | null;
    arriveOn: Date | null;
    departOn: Date | null;
    notes: string | null;
  }[];
  items: {
    stopId: string | null;
    position: number;
    category: ItemCategory;
    title: string;
    provider: string | null;
    startAt: Date | null;
    endAt: Date | null;
    allDay: boolean;
    fromPlace: string | null;
    toPlace: string | null;
    cost: number | null;
    currency: string | null;
    status: ItemStatus;
    notes: string | null;
    links: { kind: LinkKind; label: string | null; url: string; position: number }[];
  }[];
};

export type CopyOptions = {
  newOwnerId: string;
  slug: string;
  /** "Start on" date for the copy; every date shifts by the same number of days */
  startDate?: Date | null;
  newId: () => string;
};

/** First date in the trip: its start date, else the earliest stop or item date. */
export function firstDateOf(source: Pick<CopySource, "startDate" | "stops" | "items">): Date | null {
  if (source.startDate) return source.startDate;
  const dates = [
    ...source.stops.flatMap((s) => [s.arriveOn, s.departOn]),
    ...source.items.flatMap((i) => [i.startAt, i.endAt]),
  ].filter((d): d is Date => d !== null);
  if (!dates.length) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

/**
 * Plans the rows for a copy. Everything starts as "To book", is private, and
 * credits the original. Ids are generated up front so the rows can be
 * inserted with a few createMany calls in one transaction.
 */
export function planTripCopy(source: CopySource, opts: CopyOptions) {
  const isOwnTrip = source.ownerId === opts.newOwnerId;
  const first = firstDateOf(source);
  const offset = opts.startDate && first ? daysBetween(first, opts.startDate) : 0;
  const shift = (d: Date | null) => (d && offset ? addDays(d, offset) : d);

  const tripId = opts.newId();
  const trip = {
    id: tripId,
    ownerId: opts.newOwnerId,
    slug: opts.slug,
    title: isOwnTrip ? `${source.title} (copy)`.slice(0, 100) : source.title,
    types: source.types,
    description: source.description,
    coverImageUrl: source.coverImageUrl,
    startDate: shift(source.startDate),
    endDate: shift(source.endDate),
    visibility: "PRIVATE" as const,
    publishedAt: null,
    currency: source.currency,
    budget: source.budget,
    travellers: source.travellers,
    // Credit the original (not when duplicating your own trip)
    copiedFromTripId: isOwnTrip ? null : source.id,
    copiedFromTitle: isOwnTrip ? null : source.title,
    copiedFromAuthor: isOwnTrip ? null : source.ownerName,
  };

  const stopIds = new Map<string, string>();
  const stops = [...source.stops]
    .sort((a, b) => a.position - b.position)
    .map((s, position) => {
      const id = opts.newId();
      stopIds.set(s.id, id);
      return {
        id,
        tripId,
        position,
        name: s.name,
        region: s.region,
        country: s.country,
        countryCode: s.countryCode,
        placeId: s.placeId,
        lat: s.lat,
        lng: s.lng,
        arriveOn: shift(s.arriveOn),
        departOn: shift(s.departOn),
        notes: s.notes,
      };
    });

  type CopiedItem = Omit<CopySource["items"][number], "links"> & {
    id: string;
    tripId: string;
    confirmationCode: null;
    privateNotes: null;
    createdById: string;
  };
  const items: CopiedItem[] = [];
  const links: Array<{ id: string; itemId: string; kind: LinkKind; label: string | null; url: string; position: number }> = [];
  for (const i of source.items) {
    const id = opts.newId();
    items.push({
      id,
      tripId,
      stopId: i.stopId ? (stopIds.get(i.stopId) ?? null) : null,
      position: i.position,
      category: i.category,
      title: i.title,
      provider: i.provider,
      startAt: shift(i.startAt),
      endAt: shift(i.endAt),
      allDay: i.allDay,
      fromPlace: i.fromPlace,
      toPlace: i.toPlace,
      cost: i.cost,
      currency: i.currency,
      status: "TO_BOOK", // nothing is booked for the new traveller yet
      confirmationCode: null,
      notes: i.notes,
      privateNotes: null,
      createdById: opts.newOwnerId, // copying counts as adding them to your own trip
    });
    shareableLinks(i.links)
      .sort((a, b) => a.position - b.position)
      .forEach((l, position) => links.push({ id: opts.newId(), itemId: id, kind: l.kind, label: l.label, url: l.url, position }));
  }

  return { trip, stops, items, links };
}
