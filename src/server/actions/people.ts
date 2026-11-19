"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { INVITE_DAYS, MAX_TRIP_PEOPLE } from "@/lib/limits";
import { requireTripOwner } from "@/server/permissions";
import { rateLimit } from "@/server/rate-limit";
import { requireUser } from "@/server/session";
import type { ActionResult } from "@/server/actions/builder";

// Planning together. Like every server action these are public endpoints, so
// each one checks who's calling and what they may do:
// - owner only: make or turn off the invite link, remove someone
// - any signed-in user with a working link: join
// - a member: leave

const id = z.string().min(1).max(40);
const token = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/);

function newToken() {
  return randomBytes(24).toString("base64url"); // 32 characters, 192 random bits
}

/** Makes a fresh invite link (turning off any old one). Owner only. */
export async function createInviteLink(tripId: string): Promise<ActionResult & { token?: string }> {
  const user = await requireTripOwner(id.parse(tripId));
  const now = new Date();
  const created = await db.$transaction(async (tx) => {
    await tx.tripInvite.updateMany({ where: { tripId, revokedAt: null }, data: { revokedAt: now } });
    return tx.tripInvite.create({
      data: {
        tripId,
        token: newToken(),
        createdById: user.id,
        expiresAt: new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      },
      select: { token: true },
    });
  });
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true, token: created.token };
}

/** Turns the invite link off; people who already joined stay. Owner only. */
export async function turnOffInviteLink(tripId: string): Promise<ActionResult> {
  await requireTripOwner(id.parse(tripId));
  await db.tripInvite.updateMany({ where: { tripId, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true };
}

/** Removes someone from the trip. Owner only (members use leaveTrip). */
export async function removeMember(tripId: string, userId: string): Promise<ActionResult> {
  await requireTripOwner(id.parse(tripId));
  const { count } = await db.tripMember.deleteMany({ where: { tripId, userId: id.parse(userId) } });
  if (!count) return { ok: false, message: "They're not on this trip any more." };
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true };
}

/** A member leaves a trip someone shared with them. */
export async function leaveTrip(tripId: string): Promise<ActionResult> {
  const user = await requireUser();
  const { count } = await db.tripMember.deleteMany({ where: { tripId: id.parse(tripId), userId: user.id } });
  if (!count) return { ok: false, message: "You're not a member of this trip." };
  revalidatePath("/dashboard");
  redirect("/dashboard?left=1");
}

/** Joins a trip from an invite link. */
export async function acceptInvite(inviteToken: string): Promise<ActionResult> {
  const user = await requireUser(`/invite/${encodeURIComponent(String(inviteToken))}`);
  const parsed = token.safeParse(inviteToken);
  if (!parsed.success) return { ok: false, message: "That invite link isn't valid." };
  if (!(await rateLimit(`join:${user.id}`, 20, 60_000))) return { ok: false, message: "Too many tries. Wait a minute." };

  const invite = await db.tripInvite.findUnique({
    where: { token: parsed.data },
    select: {
      revokedAt: true,
      expiresAt: true,
      trip: { select: { id: true, ownerId: true, _count: { select: { members: true } } } },
    },
  });
  if (!invite || invite.revokedAt || invite.expiresAt <= new Date()) {
    return { ok: false, message: "This invite link has expired or been turned off. Ask for a new one." };
  }
  const { trip } = invite;

  if (trip.ownerId !== user.id) {
    const already = await db.tripMember.findUnique({ where: { tripId_userId: { tripId: trip.id, userId: user.id } } });
    if (!already) {
      if (trip._count.members + 1 >= MAX_TRIP_PEOPLE) {
        return { ok: false, message: `A trip can have up to ${MAX_TRIP_PEOPLE} people.` };
      }
      await db.tripMember.create({ data: { tripId: trip.id, userId: user.id } });
    }
  }
  revalidatePath("/dashboard");
  redirect(`/trips/${trip.id}?joined=1`);
}
