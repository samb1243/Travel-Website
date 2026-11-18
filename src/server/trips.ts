import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { emptyStatusCounts, type StatusCounts } from "@/lib/status";
import type { ItemCategory, ItemStatus, LinkKind, PaymentStatus, TripType, Visibility } from "@/generated/prisma/enums";
import { toDateOnly } from "@/lib/dates";
import { editableBy } from "@/server/permissions";
import { getRates } from "@/server/rates";
import { APPROX_RATES, costInTripCurrency } from "@/lib/convert";

// Read-side data access for trips. Everything returned here is plain,
// serialisable data (Decimals become numbers) that's safe to pass to
// client components.

export type TripCardData = {
  id: string;
  slug: string;
  title: string;
  types: TripType[];
  visibility: Visibility;
  coverImageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number | null;
  countryCodes: string[];
  currency: string;
  totalCost: number;
  budget: number | null;
  stopCount: number;
  /** Stop names in route order, for the route line on the card */
  stopNames: string[];
  statusCounts: StatusCounts;
  /** The owner's name when someone else owns it and shared it with you; null for your own trips */
  sharedBy: string | null;
  /** Owner plus members */
  peopleCount: number;
};

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  types: true,
  visibility: true,
  coverImageUrl: true,
  startDate: true,
  endDate: true,
  durationDays: true,
  countryCodes: true,
  currency: true,
  totalCost: true,
  budget: true,
  _count: { select: { stops: true, members: true } },
  stops: { orderBy: { position: "asc" }, select: { name: true } },
  ownerId: true,
  owner: { select: { name: true } },
} as const;

async function statusCountsFor(tripIds: string[]): Promise<Map<string, StatusCounts>> {
  const rows = await db.item.groupBy({
    by: ["tripId", "status"],
    where: { tripId: { in: tripIds } },
    _count: { _all: true },
  });
  const map = new Map<string, StatusCounts>();
  for (const id of tripIds) map.set(id, emptyStatusCounts());
  for (const r of rows) if (r.status) map.get(r.tripId)![r.status] = r._count._all;
  return map;
}

/** The user's trips for the dashboard: their own, and ones shared with them to plan together. */
export async function listMyTrips(userId: string): Promise<TripCardData[]> {
  const trips = await db.trip.findMany({
    where: editableBy(userId),
    select: cardSelect,
    orderBy: [{ startDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
  });
  const counts = await statusCountsFor(trips.map((t) => t.id));
  return trips.map(({ _count, totalCost, budget, stops, ownerId, owner, ...t }) => ({
    ...t,
    totalCost: Number(totalCost),
    budget: budget === null ? null : Number(budget),
    stopCount: _count.stops,
    stopNames: stops.map((s) => s.name),
    statusCounts: counts.get(t.id)!,
    sharedBy: ownerId === userId ? null : owner.name,
    peopleCount: _count.members + 1,
  }));
}

/**
 * Full trip for its editor. Callers must have checked access first
 * (requireTripEditor). Cached per request so the layout and page share it.
 */
export const getTripForEditor = cache(async (tripId: string, userId: string) => {
  const trip = await db.trip.findFirst({
    where: { id: tripId, ...editableBy(userId) },
    include: {
      owner: { select: { name: true } },
      stops: {
        orderBy: { position: "asc" },
        include: { _count: { select: { items: true } } },
      },
      _count: { select: { stops: true, items: true } },
    },
  });
  if (!trip) return null;
  const counts = (await statusCountsFor([trip.id])).get(trip.id)!;
  return {
    ...trip,
    totalCost: Number(trip.totalCost),
    budget: trip.budget === null ? null : Number(trip.budget),
    statusCounts: counts,
    /** Only the owner can delete, change visibility and manage people */
    isOwner: trip.ownerId === userId,
  };
});

export type EditorTrip = NonNullable<Awaited<ReturnType<typeof getTripForEditor>>>;

// --- Trip builder data ---------------------------------------------------------

export type BuilderLink = { id: string; kind: LinkKind; label: string | null; url: string };

export type BuilderItem = {
  id: string;
  stopId: string | null;
  category: ItemCategory;
  title: string;
  provider: string | null;
  /** Wall-clock ISO strings ("2027-02-04T18:40:00.000Z" means 18:40 local) */
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  fromPlace: string | null;
  toPlace: string | null;
  /** In the item's own currency (see `currency`) */
  cost: number | null;
  /** The price's currency; null = the trip's currency */
  currency: string | null;
  /** `cost` converted into the trip's currency at today's rate (same as cost when no currency) */
  costInTripCurrency: number | null;
  /** Null only for gear / other with no status picked */
  status: ItemStatus | null;
  payment: PaymentStatus | null;
  address: string | null;
  /** A web link or an uploaded photo (/img/<id>) */
  imageUrl: string | null;
  /** A copied item whose original had a confirmation: remind to add your own */
  needsOwnConfirmation: boolean;
  confirmationCode: string | null;
  notes: string | null;
  privateNotes: string | null;
  links: BuilderLink[];
  /** Who added it; only filled in on trips planned together, never on shared pages */
  addedBy: { name: string; isYou: boolean } | null;
};

export type BuilderStop = {
  id: string;
  name: string;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  /** "YYYY-MM-DD" */
  arriveOn: string | null;
  departOn: string | null;
  notes: string | null;
  items: BuilderItem[];
};

/** Dated items in time order, then undated ones in the order they were added. */
function byTime(a: { startAt: Date | null; position: number }, b: { startAt: Date | null; position: number }) {
  if (a.startAt && b.startAt) return a.startAt.getTime() - b.startAt.getTime() || a.position - b.position;
  if (a.startAt) return -1;
  if (b.startAt) return 1;
  return a.position - b.position;
}

/** Everything the route builder needs, for the trip's editor only. */
export async function getTripBuilderData(tripId: string, userId: string) {
  const trip = await db.trip.findFirst({
    where: { id: tripId, ...editableBy(userId) },
    select: {
      stops: { orderBy: { position: "asc" } },
      items: {
        include: {
          links: { orderBy: { position: "asc" } },
          createdBy: { select: { id: true, name: true } },
        },
      },
      _count: { select: { members: true } },
      currency: true,
    },
  });
  if (!trip) return null;

  const groupTrip = trip._count.members > 0;
  // Rates only matter when something is priced in another currency.
  const rates = trip.items.some((i) => i.currency && i.currency !== trip.currency) ? (await getRates()).table : APPROX_RATES;
  const items = [...trip.items].sort(byTime).map(
    (i): BuilderItem => ({
      id: i.id,
      stopId: i.stopId,
      category: i.category,
      title: i.title,
      provider: i.provider,
      startAt: i.startAt?.toISOString() ?? null,
      endAt: i.endAt?.toISOString() ?? null,
      allDay: i.allDay,
      fromPlace: i.fromPlace,
      toPlace: i.toPlace,
      cost: i.cost === null ? null : Number(i.cost),
      currency: i.currency,
      costInTripCurrency: costInTripCurrency(i.cost, i.currency, trip.currency, rates),
      status: i.status,
      payment: i.payment,
      address: i.address,
      imageUrl: i.imageUrl,
      // Only until they add a confirmation number or link of their own
      needsOwnConfirmation:
        i.needsOwnConfirmation && !i.confirmationCode && !i.links.some((l) => l.kind === "CONFIRMATION"),
      confirmationCode: i.confirmationCode,
      notes: i.notes,
      privateNotes: i.privateNotes,
      links: i.links.map((l) => ({ id: l.id, kind: l.kind, label: l.label, url: l.url })),
      // Only worth saying who added what when more than one person is planning
      addedBy:
        groupTrip && i.createdBy ? { name: i.createdBy.name, isYou: i.createdBy.id === userId } : null,
    }),
  );

  const stops = trip.stops.map(
    (s): BuilderStop => ({
      id: s.id,
      name: s.name,
      region: s.region,
      country: s.country,
      countryCode: s.countryCode,
      placeId: s.placeId,
      lat: s.lat,
      lng: s.lng,
      arriveOn: s.arriveOn ? toDateOnly(s.arriveOn) : null,
      departOn: s.departOn ? toDateOnly(s.departOn) : null,
      notes: s.notes,
      items: items.filter((i) => i.stopId === s.id),
    }),
  );

  return { stops, tripItems: items.filter((i) => i.stopId === null) };
}
