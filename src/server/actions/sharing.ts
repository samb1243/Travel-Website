"use server";

import { getRates } from "@/server/rates";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { MAX_ITEMS_PER_TRIP, MAX_STOPS_PER_TRIP } from "@/lib/limits";
import { planTripCopy } from "@/lib/sharing";
import { checkNewTripAllowed } from "@/server/trip-limits";
import { makeTripSlug } from "@/lib/slug";
import { optionalDate } from "@/lib/validation/common";
import { requireTripOwner } from "@/server/permissions";
import { requireUser } from "@/server/session";
import { canView, getCopySource } from "@/server/shared-trips";
import { refreshTripSummary } from "@/server/trip-summary";
import type { ActionResult } from "@/server/actions/builder";

// Sharing actions. Like every server action these are public HTTP endpoints:
// each re-checks the user and what they may do, and validates its input.

const id = z.string().min(1).max(40);
const visibilitySchema = z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]);

/** Owner only. Public trips get a publishedAt the first time, for Explore's "newest". */
export async function setVisibility(tripId: string, visibility: string): Promise<ActionResult> {
  await requireTripOwner(id.parse(tripId));
  const parsed = visibilitySchema.safeParse(visibility);
  if (!parsed.success) return { ok: false, message: "Pick who can see this trip." };

  const current = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { publishedAt: true, slug: true } });
  await db.trip.update({
    where: { id: tripId },
    data: {
      visibility: parsed.data,
      ...(parsed.data === "PUBLIC" && !current.publishedAt ? { publishedAt: new Date() } : {}),
    },
  });

  revalidatePath(`/trips/${tripId}`, "layout");
  revalidatePath(`/t/${current.slug}`);
  revalidatePath("/explore");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Save or unsave someone else's public/unlisted trip. */
export async function setSaved(tripId: string, save: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const trip = await canView(id.parse(tripId), user.id);
  if (!trip) return { ok: false, message: "That trip isn't available any more." };
  if (trip.ownerId === user.id) return { ok: false, message: "This is your own trip." };

  if (save === true) {
    await db.savedTrip.upsert({
      where: { userId_tripId: { userId: user.id, tripId } },
      create: { userId: user.id, tripId },
      update: {},
    });
  } else {
    await db.savedTrip.deleteMany({ where: { userId: user.id, tripId } });
  }

  revalidatePath(`/t/${trip.slug}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

const copyInput = z.object({ startDate: optionalDate });

/**
 * Deep-copies a trip the user can see into a new private trip of theirs:
 * every booking reset to "To book", personal details left behind, and a
 * "Based on X's trip" credit. Optionally moves all dates to a new start date.
 */
export async function copyTrip(tripId: string, input: { startDate: string }): Promise<ActionResult> {
  const user = await requireUser();
  const parsedId = id.safeParse(tripId);
  const parsed = copyInput.safeParse(input);
  if (!parsedId.success) return { ok: false, message: "That trip isn't available." };
  if (!parsed.success) return { ok: false, errors: { startDate: "Enter a valid date" } };

  const source = await getCopySource(parsedId.data, user.id);
  if (!source) return { ok: false, message: "That trip isn't available any more." };
  const limited = await checkNewTripAllowed(user.id);
  if (limited) return { ok: false, message: limited };
  if (source.stops.length > MAX_STOPS_PER_TRIP || source.items.length > MAX_ITEMS_PER_TRIP) {
    return { ok: false, message: "This trip is too big to copy." };
  }

  const plan = planTripCopy(source, {
    newOwnerId: user.id,
    slug: makeTripSlug(source.title),
    startDate: parsed.data.startDate,
    newId: randomUUID,
  });

  const { table: rates } = await getRates();
  await db.$transaction(async (tx) => {
    await tx.trip.create({ data: plan.trip });
    if (plan.stops.length) await tx.stop.createMany({ data: plan.stops });
    if (plan.items.length) await tx.item.createMany({ data: plan.items });
    if (plan.links.length) await tx.itemLink.createMany({ data: plan.links });
    await refreshTripSummary(tx, plan.trip.id, rates);
  });

  revalidatePath("/dashboard");
  redirect(`/trips/${plan.trip.id}?copied=1`);
}
