import "server-only";
import { db } from "@/lib/db";
import { MAX_TRIPS_PER_USER } from "@/lib/limits";
import { rateLimit } from "@/server/rate-limit";

// Not in a "use server" file on purpose: anything exported from one becomes a
// public endpoint, and this takes a user id it trusts.

/** null if the user may create (or copy) another trip, else the reason they can't. */
export async function checkNewTripAllowed(userId: string): Promise<string | null> {
  if (!(await rateLimit(`new-trip:${userId}`, 20, 60_000))) return "That's a lot of new trips at once. Wait a minute and try again.";
  if ((await db.trip.count({ where: { ownerId: userId } })) >= MAX_TRIPS_PER_USER) {
    return `You can have up to ${MAX_TRIPS_PER_USER} trips. Delete an old one to make room.`;
  }
  return null;
}
