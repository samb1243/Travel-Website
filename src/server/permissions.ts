import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser, type CurrentUser } from "@/server/session";

// Who may do what with a trip.
//
// - Editors: the owner and the people they've invited to plan with them
//   (TripMember). Editors can change stops, bookings and trip details.
// - Owner only: deleting the trip, changing who can see it (visibility), and
//   managing members and invite links.
//
// Anyone else gets a 404, the same as for a trip that doesn't exist, so
// private trip ids can't be probed.

/** Prisma filter: trips this user may edit (owns, or is a member of). */
export function editableBy(userId: string): Prisma.TripWhereInput {
  return { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };
}

export async function canEditTrip(userId: string, tripId: string): Promise<boolean> {
  const trip = await db.trip.findFirst({ where: { id: tripId, ...editableBy(userId) }, select: { id: true } });
  return trip !== null;
}

/**
 * For pages and actions that change a trip. Signed-out users go to /login;
 * signed-in users who can't edit get a 404.
 */
export async function requireTripEditor(tripId: string, returnTo?: string): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (typeof tripId !== "string" || !(await canEditTrip(user.id, tripId))) notFound();
  return user;
}

/** For owner-only actions: delete, visibility, members and invites. Members get a 404 too. */
export async function requireTripOwner(tripId: string): Promise<CurrentUser> {
  const user = await requireUser();
  const trip =
    typeof tripId === "string"
      ? await db.trip.findFirst({ where: { id: tripId, ownerId: user.id }, select: { id: true } })
      : null;
  if (!trip) notFound();
  return user;
}

/** Access check for a stop: returns its trip id if the user may edit that trip. */
export async function requireStopEditor(stopId: string): Promise<{ user: CurrentUser; tripId: string }> {
  const user = await requireUser();
  const stop = await db.stop.findFirst({
    where: { id: stopId, trip: editableBy(user.id) },
    select: { tripId: true },
  });
  if (!stop) notFound();
  return { user, tripId: stop.tripId };
}

/** Access check for an item: returns its trip id if the user may edit that trip. */
export async function requireItemEditor(itemId: string): Promise<{ user: CurrentUser; tripId: string }> {
  const user = await requireUser();
  const item = await db.item.findFirst({
    where: { id: itemId, trip: editableBy(user.id) },
    select: { tripId: true },
  });
  if (!item) notFound();
  return { user, tripId: item.tripId };
}
