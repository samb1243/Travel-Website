import "server-only";
import { db } from "@/lib/db";

// Read side for planning together: who's on a trip, and invite links.

export type TripPerson = { id: string; name: string; image: string | null; isOwner: boolean };

export type TripPeople = {
  people: TripPerson[];
  /** Only loaded for the owner: the trip's working invite link, if any */
  invite: { token: string; expiresAt: string } | null;
};

/** Owner first, then members in the order they joined. Names and avatars only, never emails. */
export async function getTripPeople(tripId: string, viewerId: string): Promise<TripPeople> {
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: {
      ownerId: true,
      owner: { select: { id: true, name: true, image: true } },
      members: { orderBy: { createdAt: "asc" }, select: { user: { select: { id: true, name: true, image: true } } } },
    },
  });
  const isOwner = trip.ownerId === viewerId;
  const invite = isOwner
    ? await db.tripInvite.findFirst({
        where: { tripId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { token: true, expiresAt: true },
      })
    : null;
  return {
    people: [
      { ...trip.owner, isOwner: true },
      ...trip.members.map((m) => ({ ...m.user, isOwner: false })),
    ],
    invite: invite ? { token: invite.token, expiresAt: invite.expiresAt.toISOString() } : null,
  };
}

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/**
 * An invite as the person opening the link sees it, or null if the link is
 * wrong, expired or turned off. Tokens are unguessable, so the trip's title and
 * owner are fine to show to whoever holds one.
 */
export async function getInvite(token: string, viewerId: string) {
  if (!TOKEN.test(token)) return null;
  const invite = await db.tripInvite.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      expiresAt: true,
      trip: {
        select: {
          id: true,
          title: true,
          types: true,
          coverImageUrl: true,
          startDate: true,
          endDate: true,
          ownerId: true,
          owner: { select: { name: true } },
          _count: { select: { members: true, stops: true } },
          members: { where: { userId: viewerId }, select: { userId: true } },
        },
      },
    },
  });
  if (!invite || invite.revokedAt || invite.expiresAt <= new Date()) return null;
  const { trip } = invite;
  return {
    tripId: trip.id,
    title: trip.title,
    types: trip.types,
    coverImageUrl: trip.coverImageUrl,
    startDate: trip.startDate,
    endDate: trip.endDate,
    ownerName: trip.owner.name,
    peopleCount: trip._count.members + 1,
    stopCount: trip._count.stops,
    alreadyIn: trip.ownerId === viewerId || trip.members.length > 0,
  };
}
