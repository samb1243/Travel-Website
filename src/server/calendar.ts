import "server-only";
import { db } from "@/lib/db";
import { tripToIcs, type CalendarItem } from "@/lib/ics";
import { canEditTrip } from "@/server/permissions";
import { getTripBuilderData } from "@/server/trips";

// Calendar export. Both the download and the private feed contain the trip's
// bookings including confirmation numbers (handy at check-in), but never
// private notes, because calendar services keep a copy.

const FEED_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** The trip as an .ics file, for someone who can edit it; null otherwise. */
export async function buildTripIcs(tripId: string, userId: string, origin: string): Promise<string | null> {
  const [trip, data] = await Promise.all([
    db.trip.findUnique({ where: { id: tripId }, select: { title: true, description: true } }),
    getTripBuilderData(tripId, userId),
  ]);
  if (!trip || !data) return null;

  const stopName = new Map(data.stops.map((s) => [s.id, s.name]));
  const items: CalendarItem[] = [...data.stops.flatMap((s) => s.items), ...data.tripItems].map((i) => ({
    id: i.id,
    category: i.category,
    title: i.title,
    provider: i.provider,
    startAt: i.startAt,
    endAt: i.endAt,
    allDay: i.allDay,
    fromPlace: i.fromPlace,
    toPlace: i.toPlace,
    status: i.status,
    confirmationCode: i.confirmationCode,
    notes: i.notes, // shared notes only; privateNotes are deliberately left out
    links: i.links,
    stopName: i.stopId ? (stopName.get(i.stopId) ?? null) : null,
  }));

  return tripToIcs({
    tripId,
    title: trip.title,
    description: trip.description,
    stops: data.stops.map((s) => ({ id: s.id, name: s.name, country: s.country, arriveOn: s.arriveOn, departOn: s.departOn })),
    items,
    generatedAt: new Date(),
    tripUrl: `${origin}/trips/${tripId}`,
  });
}

/** The user's working calendar link for a trip, if they've made one. */
export async function getActiveFeedToken(tripId: string, userId: string): Promise<string | null> {
  const feed = await db.calendarFeed.findFirst({
    where: { tripId, userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  return feed?.token ?? null;
}

/**
 * Resolves a feed link to its calendar. Null if the link is wrong or reset,
 * or if its owner can no longer edit the trip (left or was removed).
 */
export async function calendarForFeed(token: string, origin: string): Promise<{ ics: string; slug: string } | null> {
  if (!FEED_TOKEN.test(token)) return null;
  const feed = await db.calendarFeed.findUnique({
    where: { token },
    select: { tripId: true, userId: true, revokedAt: true, trip: { select: { slug: true } } },
  });
  if (!feed || feed.revokedAt) return null;
  if (!(await canEditTrip(feed.userId, feed.tripId))) return null;
  const ics = await buildTripIcs(feed.tripId, feed.userId, origin);
  return ics ? { ics, slug: feed.trip.slug } : null;
}
