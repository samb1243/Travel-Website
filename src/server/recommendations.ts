import "server-only";
import { db } from "@/lib/db";
import { convertAmount } from "@/lib/convert";
import { daysBetween } from "@/lib/dates";
import { buildIdeas, IDEA_CATEGORIES, type Idea, type IdeaCategory, type IdeaSource } from "@/lib/recommendations";
import { getRates } from "@/server/rates";

// Ideas for one stop from other travellers' public trips through the same
// place. Matches by OpenStreetMap place id when both stops have one, else by
// name and country. Selects only fields public trip pages already show; the
// 3-traveller rule is in src/lib/recommendations.ts.

const MAX_MATCHING_STOPS = 500;

export type StopIdeas = { stopName: string; currency: string; ideas: Idea[] };

/** Ideas for a stop the viewer can edit (the caller checks that). */
export async function getStopIdeas(stopId: string, viewerId: string): Promise<StopIdeas | null> {
  const stop = await db.stop.findUnique({
    where: { id: stopId },
    select: {
      name: true,
      countryCode: true,
      placeId: true,
      tripId: true,
      trip: { select: { currency: true } },
      items: { select: { category: true, title: true } },
    },
  });
  if (!stop) return null;

  const samePlace = [
    ...(stop.placeId ? [{ placeId: stop.placeId }] : []),
    ...(stop.countryCode ? [{ name: { equals: stop.name, mode: "insensitive" as const }, countryCode: stop.countryCode }] : []),
  ];
  if (!samePlace.length) return { stopName: stop.name, currency: stop.trip.currency, ideas: [] };

  const matches = await db.stop.findMany({
    where: {
      OR: samePlace,
      tripId: { not: stop.tripId },
      // Other people's public trips only: not unlisted or private, not the
      // viewer's own, and not ones they plan together
      trip: { visibility: "PUBLIC", ownerId: { not: viewerId }, members: { none: { userId: viewerId } } },
    },
    take: MAX_MATCHING_STOPS,
    select: {
      trip: { select: { ownerId: true, currency: true, travellers: true } },
      items: {
        where: { category: { in: [...IDEA_CATEGORIES] } },
        select: { category: true, title: true, provider: true, address: true, cost: true, currency: true, startAt: true, endAt: true },
      },
    },
  });

  const anyPrice = matches.some((m) => m.items.some((i) => i.cost !== null));
  const rates = anyPrice ? (await getRates()).table : null;
  const sources: IdeaSource[] = matches.flatMap((m) =>
    m.items.map((i) => {
      let price: number | null = null;
      if (rates && i.cost !== null && Number(i.cost) > 0) {
        const inViewerCurrency = convertAmount(i.cost, i.currency ?? m.trip.currency, stop.trip.currency, rates);
        if (inViewerCurrency !== null) {
          if (i.category === "ACCOMMODATION") {
            // Stays: per night, when the dates say how many
            const nights = i.startAt && i.endAt ? daysBetween(i.startAt, i.endAt) : 0;
            price = nights > 0 ? inViewerCurrency / nights : null;
          } else {
            price = inViewerCurrency / Math.max(1, m.trip.travellers);
          }
          if (price !== null) price = Math.round(price * 100) / 100;
        }
      }
      return {
        ownerId: m.trip.ownerId,
        category: i.category as IdeaCategory,
        title: i.title,
        provider: i.provider,
        address: i.address,
        price,
      };
    }),
  );

  return { stopName: stop.name, currency: stop.trip.currency, ideas: buildIdeas(sources, stop.items) };
}
