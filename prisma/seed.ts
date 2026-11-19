// Loads example users and trips. Safe to run repeatedly: it removes the demo
// users' trips and recreates them. Run with:  npm run db:seed

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { refreshTripSummary } from "../src/server/trip-summary";
import { APPROX_RATES } from "../src/lib/convert";
import { fetchLatestRates } from "../src/lib/rates-fetch";
import { addDays, atTime, parseDateOnly } from "../src/lib/dates";
import { makeTripSlug } from "../src/lib/slug";
import { DEMO_PASSWORD, SEED_TRIPS, SEED_USERS, type SeedItem } from "./seed-data";

// The demo accounts share a published password, so never create them on a live site.
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "yes") {
  console.error("Refusing to seed demo accounts with NODE_ENV=production (set ALLOW_DEMO_SEED=yes to override).");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function itemData(item: SeedItem, tripStart: Date, position: number, users: Map<string, string>) {
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
    currency: item.currency ?? null,
    status: item.status ?? null,
    payment: item.payment ?? null,
    address: item.address ?? null,
    confirmationCode: item.confirmationCode ?? null,
    notes: item.notes ?? null,
    privateNotes: item.privateNotes ?? null,
    // Relation form (not paidById): these items are created with createdBy too
    ...(item.paidBy && users.has(item.paidBy) ? { paidBy: { connect: { id: users.get(item.paidBy)! } } } : {}),
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
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const u of SEED_USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, homeCurrency: u.homeCurrency },
      create: { ...u, emailVerified: true },
    });
    users.set(u.email, user.id);

    // Email + password login, stored the same way Better Auth does on sign-up.
    await db.account.deleteMany({ where: { userId: user.id, providerId: "credential" } });
    await db.account.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      },
    });
  }
  console.log(`Demo logins: ${SEED_USERS.map((u) => u.email).join(", ")} / password "${DEMO_PASSWORD}"`);

  // Live exchange rates for the demo trips' foreign-currency bookings (rough built-in ones offline)
  const rates = await fetchLatestRates()
    .then((r) => r.table)
    .catch(() => APPROX_RATES);

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
        types: t.types,
        visibility: t.visibility,
        description: t.description,
        coverImageUrl: t.coverImageUrl ?? null,
        startDate: start,
        endDate: parseDateOnly(t.endDate),
        currency: t.currency,
        budget: t.budget ?? null,
        travellers: t.travellers,
        publishedAt: t.visibility === "PUBLIC" ? new Date() : null,
        items: {
          create: [...(t.items ?? [])]
            .sort(byStart)
            .map((item, i) => ({ ...itemData(item, start, i, users), createdBy: { connect: { id: ownerId } } })),
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
              .map((item, i) => ({
                ...itemData(item, start, i, users),
                trip: { connect: { id: trip.id } },
                createdBy: { connect: { id: ownerId } },
              })),
          },
        },
      });
    }

    for (const email of t.members ?? []) {
      await db.tripMember.create({ data: { tripId: trip.id, userId: users.get(email)! } });
    }
    for (const p of t.settlements ?? []) {
      await db.settlement.create({
        data: { tripId: trip.id, fromId: users.get(p.from)!, toId: users.get(p.to)!, amount: p.amount, currency: t.currency, createdById: ownerId },
      });
    }

    const summary = await refreshTripSummary(db, trip.id, rates);
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
