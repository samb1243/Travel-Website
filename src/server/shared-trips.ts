import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { toDateOnly } from "@/lib/dates";
import { countryScope, PAGE_SIZE, type ExploreFilters } from "@/lib/explore";
import { canViewTrip, stripPersonal, type CopySource } from "@/lib/sharing";
import { APPROX_RATES, convertAmount, costInTripCurrency, type RateTable } from "@/lib/convert";
import { getRates } from "@/server/rates";
import type { Prisma } from "@/generated/prisma/client";
import type { BuilderItem, BuilderStop } from "@/server/trips";

// Read-side access for trips seen by people other than their owner.
//
// Privacy: queries here use an explicit `select` allowlist. Personal fields
// (Item.confirmationCode, Item.privateNotes, CONFIRMATION links, the owner's
// email) are never selected, and every item also goes through stripPersonal()
// as a second layer. Private trips come back as null, exactly like a trip
// that doesn't exist.

const sharedTripSelect = {
  id: true,
  ownerId: true,
  slug: true,
  title: true,
  types: true,
  description: true,
  coverImageUrl: true,
  startDate: true,
  endDate: true,
  visibility: true,
  currency: true,
  budget: true,
  travellers: true,
  durationDays: true,
  countryCodes: true,
  totalCost: true,
  publishedAt: true,
  copiedFromTitle: true,
  copiedFromAuthor: true,
  owner: { select: { name: true, image: true } },
  // Only used for the access check below; never sent to the page.
  members: { select: { userId: true } },
  stops: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      position: true,
      name: true,
      region: true,
      country: true,
      countryCode: true,
      placeId: true,
      lat: true,
      lng: true,
      arriveOn: true,
      departOn: true,
      notes: true,
    },
  },
  items: {
    orderBy: [{ startAt: { sort: "asc", nulls: "last" } }, { position: "asc" }],
    select: {
      id: true,
      stopId: true,
      position: true,
      category: true,
      title: true,
      provider: true,
      startAt: true,
      endAt: true,
      allDay: true,
      fromPlace: true,
      toPlace: true,
      cost: true,
      currency: true,
      status: true,
      payment: true,
      address: true,
      imageUrl: true,
      notes: true,
      links: {
        where: { kind: { not: "CONFIRMATION" } },
        orderBy: { position: "asc" },
        select: { id: true, kind: true, label: true, url: true, position: true },
      },
    },
  },
} satisfies Prisma.TripSelect;

type SharedTripRow = Prisma.TripGetPayload<{ select: typeof sharedTripSelect }>;

async function findViewable(where: Prisma.TripWhereUniqueInput, viewerId: string | null): Promise<SharedTripRow | null> {
  const trip = await db.trip.findUnique({ where, select: sharedTripSelect });
  if (!trip || !canViewTrip({ ...trip, memberIds: trip.members.map((m) => m.userId) }, viewerId)) return null;
  return trip;
}

function toSharedItem(i: SharedTripRow["items"][number], tripCurrency: string, rates: RateTable): BuilderItem {
  return stripPersonal({
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
    costInTripCurrency: costInTripCurrency(i.cost, i.currency, tripCurrency, rates),
    status: i.status,
    payment: i.payment,
    address: i.address,
    imageUrl: i.imageUrl,
    needsOwnConfirmation: false,
    notes: i.notes,
    links: i.links.map((l) => ({ id: l.id, kind: l.kind, label: l.label, url: l.url })),
    addedBy: null, // group members' names are never shown on public pages
    paidById: null, // nor who paid for what
    splitWith: [],
    documents: [], // tickets and documents are never shared
  });
}

/**
 * A trip as other people see it, or null if it doesn't exist or the viewer
 * may not see it. Cached per request (page + metadata share one query).
 */
export const getSharedTrip = cache(async (slug: string, viewerId: string | null) => {
  if (!/^[a-z0-9-]{1,140}$/.test(slug)) return null;
  const trip = await findViewable({ slug }, viewerId);
  if (!trip) return null;

  const rates = trip.items.some((i) => i.currency && i.currency !== trip.currency) ? (await getRates()).table : APPROX_RATES;
  const items = trip.items.map((i) => toSharedItem(i, trip.currency, rates));
  const stops: BuilderStop[] = trip.stops.map((s) => ({
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
  }));

  const [saved, saveCount] = await Promise.all([
    viewerId ? db.savedTrip.count({ where: { userId: viewerId, tripId: trip.id } }) : 0,
    db.savedTrip.count({ where: { tripId: trip.id } }),
  ]);

  return {
    // ownerId is only used for the comparison below; it isn't sent to the browser
    trip: {
      id: trip.id,
      slug: trip.slug,
      title: trip.title,
      types: trip.types,
      description: trip.description,
      coverImageUrl: trip.coverImageUrl,
      startDate: trip.startDate ? toDateOnly(trip.startDate) : null,
      endDate: trip.endDate ? toDateOnly(trip.endDate) : null,
      visibility: trip.visibility,
      currency: trip.currency,
      budget: trip.budget === null ? null : Number(trip.budget),
      travellers: trip.travellers,
      durationDays: trip.durationDays,
      countryCodes: trip.countryCodes,
      totalCost: Number(trip.totalCost),
      copiedFromTitle: trip.copiedFromTitle,
      copiedFromAuthor: trip.copiedFromAuthor,
      authorName: trip.owner.name,
      authorImage: trip.owner.image,
    },
    stops,
    tripItems: items.filter((i) => i.stopId === null),
    isOwner: trip.ownerId === viewerId,
    /** Owner or member: can open the editor */
    canEdit: trip.ownerId === viewerId || trip.members.some((m) => m.userId === viewerId),
    saved: saved > 0,
    saveCount,
  };
});

export type SharedTrip = NonNullable<Awaited<ReturnType<typeof getSharedTrip>>>;

/** The source for "Copy this trip": same visibility rule and allowlist as the shared view. */
export async function getCopySource(tripId: string, viewerId: string): Promise<CopySource | null> {
  const trip = await findViewable({ id: tripId }, viewerId);
  if (!trip) return null;
  // Only *whether* each item had a confirmation is used (to remind the new
  // traveller to add theirs); the numbers and links themselves are never read.
  const confirmed = new Set(
    (
      await db.item.findMany({
        where: {
          tripId: trip.id,
          OR: [{ confirmationCode: { not: null } }, { links: { some: { kind: "CONFIRMATION" } } }],
        },
        select: { id: true },
      })
    ).map((i) => i.id),
  );
  return {
    id: trip.id,
    ownerId: trip.ownerId,
    ownerName: trip.owner.name,
    title: trip.title,
    types: trip.types,
    description: trip.description,
    coverImageUrl: trip.coverImageUrl,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currency: trip.currency,
    budget: trip.budget === null ? null : Number(trip.budget),
    travellers: trip.travellers,
    stops: trip.stops,
    items: trip.items.map((i) => ({
      ...i,
      cost: i.cost === null ? null : Number(i.cost),
      hadConfirmation: confirmed.has(i.id),
    })),
  };
}

/** Whether `viewerId` may see the trip (for save/unsave). */
export async function canView(tripId: string, viewerId: string): Promise<{ ownerId: string; slug: string } | null> {
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { ownerId: true, visibility: true, slug: true } });
  return trip && canViewTrip(trip, viewerId) ? { ownerId: trip.ownerId, slug: trip.slug } : null;
}

// --- Explore -------------------------------------------------------------------------

export type ExploreCard = {
  id: string;
  slug: string;
  title: string;
  types: SharedTripRow["types"];
  coverImageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number | null;
  countryCodes: string[];
  currency: string;
  totalCost: number;
  travellers: number;
  stopCount: number;
  /** Stop names in route order, for the route line on the card */
  stopNames: string[];
  saveCount: number;
  authorName: string;
};

/** Who's looking: their own trips (and ones they plan together) are left out, and budgets are in their currency. */
export type ExploreViewer = { id: string | null; homeCurrency: string };

async function exploreWhere(f: ExploreFilters, viewer: ExploreViewer): Promise<Prisma.TripWhereInput> {
  const where: Prisma.TripWhereInput = { visibility: "PUBLIC" }; // unlisted trips never appear here
  const and: Prisma.TripWhereInput[] = [];
  // Explore is for other people's trips
  if (viewer.id) and.push({ ownerId: { not: viewer.id } }, { members: { none: { userId: viewer.id } } });
  if (f.type) where.types = { has: f.type }; // a trip matches any of its types
  const countries = countryScope(f);
  if (countries) where.countryCodes = { hasSome: countries };
  if (f.minDays || f.maxDays) {
    where.durationDays = { ...(f.minDays && { gte: f.minDays }), ...(f.maxDays && { lte: f.maxDays }) };
  }
  if (f.minBudget || f.maxBudget) {
    // Trips store an approximate cost per person in euros, for exactly this
    const cur = f.currency ?? viewer.homeCurrency;
    const rates = cur === "EUR" ? APPROX_RATES : (await getRates()).table;
    const eur = (n: number | null) => (n ? (convertAmount(n, cur, "EUR", rates) ?? n) : null);
    const min = eur(f.minBudget);
    const max = eur(f.maxBudget);
    where.costPerPersonEur = { ...(min !== null && { gte: min }), ...(max !== null && { lte: max }) };
  }
  if (and.length) where.AND = and;
  return where;
}

export async function listPublicTrips(
  filters: ExploreFilters,
  viewer: ExploreViewer = { id: null, homeCurrency: "EUR" },
): Promise<{ trips: ExploreCard[]; total: number }> {
  const where = await exploreWhere(filters, viewer);
  const [rows, total] = await Promise.all([
    db.trip.findMany({
      where,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        types: true,
        coverImageUrl: true,
        startDate: true,
        endDate: true,
        durationDays: true,
        countryCodes: true,
        currency: true,
        totalCost: true,
        travellers: true,
        owner: { select: { name: true } },
        _count: { select: { stops: true, savedBy: true } },
        stops: { orderBy: { position: "asc" }, select: { name: true } },
      },
    }),
    db.trip.count({ where }),
  ]);
  return {
    total,
    trips: rows.map(({ owner, _count, totalCost, stops, ...t }) => ({
      ...t,
      stopNames: stops.map((s) => s.name),
      totalCost: Number(totalCost),
      stopCount: _count.stops,
      saveCount: _count.savedBy,
      authorName: owner.name,
    })),
  };
}

/** Countries that appear in other people's public trips, for the Explore filter. */
export async function listExploreCountries(viewerId: string | null = null): Promise<string[]> {
  // Fine at this scale; switch to SELECT DISTINCT unnest(...) when there are many trips.
  const rows = await db.trip.findMany({
    where: { visibility: "PUBLIC", ...(viewerId && { ownerId: { not: viewerId } }) },
    select: { countryCodes: true },
  });
  return [...new Set(rows.flatMap((r) => r.countryCodes))].sort();
}

/** Trips the user saved that they can still see (a trip made private drops out). */
export async function listSavedTrips(userId: string): Promise<ExploreCard[]> {
  const rows = await db.savedTrip.findMany({
    where: { userId, trip: { visibility: { in: ["PUBLIC", "UNLISTED"] } } },
    orderBy: { createdAt: "desc" },
    select: {
      trip: {
        select: {
          id: true,
          slug: true,
          title: true,
          types: true,
          coverImageUrl: true,
          startDate: true,
          endDate: true,
          durationDays: true,
          countryCodes: true,
          currency: true,
          totalCost: true,
          travellers: true,
          owner: { select: { name: true } },
          _count: { select: { stops: true, savedBy: true } },
          stops: { orderBy: { position: "asc" }, select: { name: true } },
        },
      },
    },
  });
  return rows.map(({ trip: { owner, _count, totalCost, stops, ...t } }) => ({
    ...t,
    stopNames: stops.map((s) => s.name),
    totalCost: Number(totalCost),
    stopCount: _count.stops,
    saveCount: _count.savedBy,
    authorName: owner.name,
  }));
}
