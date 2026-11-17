import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { db } from "@/lib/db";
import { refreshTripSummary } from "@/server/trip-summary";
import type { CurrentUser } from "@/server/session";
import type { Visibility } from "@/generated/prisma/enums";
import { NotFoundError, RedirectError } from "./errors";

export { db };

/** Personal details planted in fixtures; none may ever reach another user. */
export const SECRET_CODE = "SECRET-CONF-7781";
export const SECRET_NOTE = "secret: paid with card ending 4242";
export const SECRET_LINK = "https://example.com/my-booking?token=secret-token-123";

export function signInAs(user: CurrentUser | null) {
  (globalThis as unknown as { __testUser?: CurrentUser | null }).__testUser = user;
}

export async function makeUser(name: string): Promise<CurrentUser> {
  const id = randomUUID();
  const email = `${name.toLowerCase()}-${id.slice(0, 8)}@test.example`;
  await db.user.create({ data: { id, name, email, emailVerified: true } });
  return { id, name, email, image: null, homeCurrency: "EUR" };
}

/** A trip with one stop and one item carrying every kind of personal detail. */
export async function makeTrip(ownerId: string, visibility: Visibility, title = `${visibility} trip`) {
  const trip = await db.trip.create({
    data: {
      ownerId,
      title,
      slug: `${title.toLowerCase().replace(/\W+/g, "-")}-${randomUUID().slice(0, 10)}`,
      visibility,
      currency: "EUR",
      budget: 1000,
      startDate: new Date("2027-05-01T00:00:00Z"),
      endDate: new Date("2027-05-05T00:00:00Z"),
      publishedAt: visibility === "PUBLIC" ? new Date() : null,
      stops: {
        create: [{ position: 0, name: "Lisbon", countryCode: "PT", lat: 38.72, lng: -9.14, arriveOn: new Date("2027-05-01T00:00:00Z") }],
      },
    },
    include: { stops: true },
  });
  const item = await db.item.create({
    data: {
      tripId: trip.id,
      stopId: trip.stops[0].id,
      category: "ACCOMMODATION",
      title: "Guesthouse in Alfama",
      cost: 300,
      status: "BOOKED",
      notes: "Shared note: ask for the terrace room",
      confirmationCode: SECRET_CODE,
      privateNotes: SECRET_NOTE,
      links: {
        create: [
          { kind: "BOOKING", url: "https://example.com/book", position: 0 },
          { kind: "CONFIRMATION", url: SECRET_LINK, position: 1 },
        ],
      },
    },
  });
  await refreshTripSummary(db, trip.id);
  return { trip, stop: trip.stops[0], item };
}

/** Asserts the call is refused with a 404, exactly like a missing trip. */
export async function expectNotFound(p: Promise<unknown>) {
  await expect(p).rejects.toBeInstanceOf(NotFoundError);
}

/** Asserts the call sends a signed-out visitor to the login page. */
export async function expectLoginRedirect(p: Promise<unknown>) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(RedirectError);
  expect((err as RedirectError).url).toMatch(/^\/login/);
}

export function expectNoSecrets(value: unknown) {
  const json = JSON.stringify(value);
  expect(json).not.toContain(SECRET_CODE);
  expect(json).not.toContain(SECRET_NOTE);
  expect(json).not.toContain(SECRET_LINK);
}

/** Snapshot of everything stored for a trip, to prove refused calls changed nothing. */
export async function tripSnapshot(tripId: string) {
  return db.trip.findUnique({
    where: { id: tripId },
    include: { stops: { orderBy: { position: "asc" } }, items: { include: { links: true }, orderBy: { id: "asc" } } },
  });
}
