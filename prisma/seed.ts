// Loads example users and trips. Safe to run repeatedly: it removes the demo
// users' trips and recreates them. Run with:  npm run db:seed

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { refreshTripSummary } from "../src/server/trip-summary";
import { addDays, atTime, parseDateOnly } from "../src/lib/dates";
import { makeTripSlug } from "../src/lib/slug";
import { SEED_TRIPS, SEED_USERS, type SeedItem } from "./seed-data";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function itemData(item: SeedItem, tripStart: Date, position: number) {
  const when = (at?: [number, string?]) => {
    if (!at) return null;
    const day = addDays(tripStart, at[0]);
    return at[1] ? atTime(day, at[1]) : day;
  };
  return {
    position,
    category: item.category,
    title: item.title,
    provider: item.provider ?? null,
    startAt: when(item.start),
    endAt: when(item.end),
    allDay: !!item.start && !item.start[1],
    fromPlace: item.from ?? null,
    toPlace: item.to ?? null,
    cost: item.cost ?? null,
    status: item.status,
    confirmationCode: item.confirmationCode ?? null,
    notes: item.notes ?? null,
    privateNotes: item.privateNotes ?? null,
    links: {
      create: (item.links ?? []).map((l, i) => ({ ...l, position: i })),
    },
  };
}

/** Undated items last; otherwise chronological. */
function byStart(a: SeedItem, b: SeedItem) {
  const key = (i: SeedItem) =>
    i.start ? i.start[0] * 10000 + (i.start[1] ? Number(i.start[1].replace(":", "")) : -1) : Infinity;
  return key(a) - key(b);
}

async function main() {
  const users = new Map<string, string>();
  for (const u of SEED_USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, homeCurrency: u.homeCurrency },
      create: { ...u, emailVerified: true },
    });
    users.set(u.email, user.id);
  }

  const deleted = await db.trip.deleteMany({ where: { ownerId: { in: [...users.values()] } } });
  if (deleted.count) console.log(`Removed ${deleted.count} existing demo trips`);

  for (const t of SEED_TRIPS) {
    const start = parseDateOnly(t.startDate);
    const ownerId = users.get(t.ownerEmail);
    if (!ownerId) throw new Error(`Unknown seed owner ${t.ownerEmail}`);

    const trip = await db.trip.create({
      data: {
        ownerId,
        slug: makeTripSlug(t.title, t.slugSuffix),
        title: t.title,
        type: t.type,
        visibility: t.visibility,
        description: t.description,
        startDate: start,
        endDate: parseDateOnly(t.endDate),
        currency: t.currency,
        budget: t.budget ?? null,
        travellers: t.travellers,
        publishedAt: t.visibility === "PUBLIC" ? new Date() : null,
        items: {
          create: [...(t.items ?? [])].sort(byStart).map((item, i) => itemData(item, start, i)),
        },
      },
    });

    for (const [position, s] of t.stops.entries()) {
      await db.stop.create({
        data: {
          tripId: trip.id,
          position,
          name: s.name,
          region: s.region ?? null,
          country: s.country,
          countryCode: s.countryCode,
          lat: s.lat,
          lng: s.lng,
          arriveOn: addDays(start, s.days[0]),
          departOn: addDays(start, s.days[1]),
          notes: s.notes ?? null,
          items: {
            create: [...(s.items ?? [])]
              .sort(byStart)
              .map((item, i) => ({ ...itemData(item, start, i), trip: { connect: { id: trip.id } } })),
          },
        },
      });
    }

    const summary = await refreshTripSummary(db, trip.id);
    console.log(
      `✓ ${t.title} [${t.visibility.toLowerCase()}]: ${t.stops.length} stops, ` +
        `${summary.durationDays} days, ${summary.countryCodes.join("/")}, ` +
        `${summary.totalCost} ${t.currency} → /t/${trip.slug}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
