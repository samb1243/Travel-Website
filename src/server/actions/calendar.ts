"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTripEditor } from "@/server/permissions";
import type { ActionResult } from "@/server/actions/builder";

// Private calendar links. Each person who can edit a trip gets their own,
// and only they can make, reset or turn off theirs.

const id = z.string().min(1).max(40);
const newToken = () => randomBytes(24).toString("base64url");

/** Returns the user's calendar link for this trip, making one if needed. */
export async function getCalendarLink(tripId: string): Promise<ActionResult & { token?: string }> {
  const user = await requireTripEditor(id.parse(tripId));
  const existing = await db.calendarFeed.findFirst({
    where: { tripId, userId: user.id, revokedAt: null },
    select: { token: true },
  });
  if (existing) return { ok: true, token: existing.token };
  const feed = await db.calendarFeed.create({ data: { tripId, userId: user.id, token: newToken() }, select: { token: true } });
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true, token: feed.token };
}

/** Replaces the user's link; calendars using the old one stop updating. */
export async function resetCalendarLink(tripId: string): Promise<ActionResult & { token?: string }> {
  const user = await requireTripEditor(id.parse(tripId));
  const feed = await db.$transaction(async (tx) => {
    await tx.calendarFeed.updateMany({ where: { tripId, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return tx.calendarFeed.create({ data: { tripId, userId: user.id, token: newToken() }, select: { token: true } });
  });
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true, token: feed.token };
}

/** Turns the user's link off. */
export async function turnOffCalendarLink(tripId: string): Promise<ActionResult> {
  const user = await requireTripEditor(id.parse(tripId));
  await db.calendarFeed.updateMany({ where: { tripId, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true };
}
