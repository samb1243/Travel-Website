import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/server/session";

/**
 * Who may change a trip. Today: only its owner.
 * Phase 2 (collaborators) extends this one function with trip members.
 */
export async function canEditTrip(userId: string, tripId: string): Promise<boolean> {
  const trip = await db.trip.findFirst({
    where: { id: tripId, ownerId: userId },
    select: { id: true },
  });
  return trip !== null;
}

/**
 * For pages and actions that change a trip. Signed-out users go to /login;
 * signed-in users who can't edit get a 404, the same as a trip that doesn't
 * exist, so private trip ids can't be probed.
 */
export async function requireTripEditor(tripId: string, returnTo?: string): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (typeof tripId !== "string" || !(await canEditTrip(user.id, tripId))) notFound();
  return user;
}

/** Access check for a stop: returns its trip id if the user may edit that trip. */
export async function requireStopEditor(stopId: string): Promise<{ user: CurrentUser; tripId: string }> {
  const user = await requireUser();
  const stop = await db.stop.findFirst({
    where: { id: stopId, trip: { ownerId: user.id } },
    select: { tripId: true },
  });
  if (!stop) notFound();
  return { user, tripId: stop.tripId };
}

/** Access check for an item: returns its trip id if the user may edit that trip. */
export async function requireItemEditor(itemId: string): Promise<{ user: CurrentUser; tripId: string }> {
  const user = await requireUser();
  const item = await db.item.findFirst({
    where: { id: itemId, trip: { ownerId: user.id } },
    select: { tripId: true },
  });
  if (!item) notFound();
  return { user, tripId: item.tripId };
}
