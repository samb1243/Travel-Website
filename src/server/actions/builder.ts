"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { MAX_ITEMS_PER_TRIP, MAX_STOPS_PER_TRIP } from "@/lib/limits";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/status";
import { fieldErrors } from "@/lib/validation/common";
import { itemSchema, type ItemFormInput } from "@/lib/validation/item";
import { stopOrderSchema, stopSchema, type StopInput } from "@/lib/validation/stop";
import { requireItemEditor, requireStopEditor, requireTripEditor } from "@/server/permissions";
import { refreshTripSummary } from "@/server/trip-summary";

// Server actions for the trip builder (stops and items). They're public HTTP
// endpoints: each one checks access to the trip and validates its input,
// whatever the UI sends.

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; errors?: Record<string, string>; message?: string };

const id = z.string().min(1).max(40);

async function afterChange(tripId: string) {
  await refreshTripSummary(db, tripId);
  revalidatePath(`/trips/${tripId}`, "layout");
  revalidatePath("/dashboard");
}

// --- Stops -------------------------------------------------------------------

export async function addStop(tripId: string, input: StopInput): Promise<ActionResult> {
  await requireTripEditor(id.parse(tripId));
  const parsed = stopSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const last = await db.stop.aggregate({ where: { tripId }, _max: { position: true }, _count: true });
  if (last._count >= MAX_STOPS_PER_TRIP) {
    return { ok: false, message: `A trip can have up to ${MAX_STOPS_PER_TRIP} stops.` };
  }
  const stop = await db.stop.create({
    data: { ...parsed.data, tripId, position: (last._max.position ?? -1) + 1 },
    select: { id: true },
  });
  await afterChange(tripId);
  return { ok: true, id: stop.id };
}

export async function updateStop(stopId: string, input: StopInput): Promise<ActionResult> {
  const { tripId } = await requireStopEditor(id.parse(stopId));
  const parsed = stopSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  await db.stop.update({ where: { id: stopId }, data: parsed.data });
  await afterChange(tripId);
  return { ok: true, id: stopId };
}

/** `keepItems`: move the stop's items to "Whole trip" instead of deleting them. */
export async function deleteStop(stopId: string, keepItems: boolean): Promise<ActionResult> {
  const { tripId } = await requireStopEditor(id.parse(stopId));
  await db.$transaction(async (tx) => {
    if (!keepItems) await tx.item.deleteMany({ where: { stopId } });
    await tx.stop.delete({ where: { id: stopId } }); // remaining items get stopId = null
    // Close the gap so positions stay 0..n-1
    const rest = await tx.stop.findMany({ where: { tripId }, orderBy: { position: "asc" }, select: { id: true } });
    await Promise.all(rest.map((s, i) => tx.stop.update({ where: { id: s.id }, data: { position: i } })));
  });
  await afterChange(tripId);
  return { ok: true };
}

export async function reorderStops(tripId: string, orderedIds: string[]): Promise<ActionResult> {
  await requireTripEditor(id.parse(tripId));
  const ids = stopOrderSchema.parse(orderedIds);

  const current = await db.stop.findMany({ where: { tripId }, select: { id: true } });
  const same =
    current.length === ids.length && new Set(ids).size === ids.length && current.every((s) => ids.includes(s.id));
  if (!same) return { ok: false, message: "The route changed in another tab. Reload and try again." };

  await db.$transaction(ids.map((stopId, position) => db.stop.update({ where: { id: stopId }, data: { position } })));
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true };
}

// --- Items -------------------------------------------------------------------

/** Create (itemId = null) or update an item, replacing its links. */
export async function saveItem(
  tripId: string,
  itemId: string | null,
  input: ItemFormInput,
): Promise<ActionResult> {
  id.parse(tripId);
  if (itemId) {
    const access = await requireItemEditor(id.parse(itemId));
    if (access.tripId !== tripId) return { ok: false, message: "That item belongs to another trip." };
  } else {
    await requireTripEditor(tripId);
    if ((await db.item.count({ where: { tripId } })) >= MAX_ITEMS_PER_TRIP) {
      return { ok: false, message: `A trip can have up to ${MAX_ITEMS_PER_TRIP} bookings and ideas.` };
    }
  }

  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { links, stopId, ...data } = parsed.data;

  // The chosen stop must be on this trip.
  if (stopId) {
    const stop = await db.stop.findFirst({ where: { id: stopId, tripId }, select: { id: true } });
    if (!stop) return { ok: false, errors: { stopId: "Pick a stop on this trip" } };
  }

  const linkRows = links.map((l, position) => ({ ...l, position }));
  const saved = await db.$transaction(async (tx) => {
    if (itemId) {
      await tx.itemLink.deleteMany({ where: { itemId } });
      return tx.item.update({
        where: { id: itemId },
        data: { ...data, stopId, links: { create: linkRows } },
        select: { id: true },
      });
    }
    const last = await tx.item.aggregate({ where: { tripId, stopId }, _max: { position: true } });
    return tx.item.create({
      data: { ...data, tripId, stopId, position: (last._max.position ?? -1) + 1, links: { create: linkRows } },
      select: { id: true },
    });
  });

  await afterChange(tripId);
  return { ok: true, id: saved.id };
}

const statusSchema = z.enum(ITEM_STATUSES);

/** One-tap status change from the checklist. Status doesn't affect costs, so no summary refresh. */
export async function setItemStatus(itemId: string, status: ItemStatus): Promise<ActionResult> {
  const { tripId } = await requireItemEditor(id.parse(itemId));
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, message: "Unknown booking status." };

  await db.item.update({ where: { id: itemId }, data: { status: parsed.data } });
  revalidatePath(`/trips/${tripId}`, "layout");
  revalidatePath("/dashboard");
  return { ok: true, id: itemId };
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  const { tripId } = await requireItemEditor(id.parse(itemId));
  await db.item.delete({ where: { id: itemId } });
  await afterChange(tripId);
  return { ok: true };
}
