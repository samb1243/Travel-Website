"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTripEditor } from "@/server/permissions";
import { requireUser } from "@/server/session";

/** Removes a ticket or document from a booking (any of the trip's planners). */
export async function deleteDocument(documentId: string): Promise<{ ok: true }> {
  const id = z.string().min(1).max(40).parse(documentId);
  await requireUser(); // signed out: to the login page first, like every action
  const doc = await db.itemDocument.findUnique({ where: { id }, select: { tripId: true } });
  if (!doc) notFound(); // same answer as "not your trip"
  await requireTripEditor(doc.tripId);
  await db.itemDocument.delete({ where: { id } });
  revalidatePath(`/trips/${doc.tripId}`, "layout");
  return { ok: true };
}
