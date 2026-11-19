"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTripEditor } from "@/server/permissions";
import { tripPeopleIds } from "@/server/people";
import { requireUser } from "@/server/session";

// Settling up on a trip planned together: recording that one person paid
// another back, and undoing that. Any of the trip's planners can do both.

type Result = { ok: true } | { ok: false; message: string };

const settlementInput = z.object({
  fromId: z.string().min(1).max(40),
  toId: z.string().min(1).max(40),
  amount: z.coerce.number().positive("Enter an amount").max(1_000_000, "That's too much for one payment"),
});

export async function recordSettlement(tripId: string, input: z.input<typeof settlementInput>): Promise<Result> {
  const user = await requireTripEditor(z.string().min(1).max(40).parse(tripId));
  const parsed = settlementInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the amount." };
  const { fromId, toId, amount } = parsed.data;
  if (fromId === toId) return { ok: false, message: "Pick two different people." };
  const people = await tripPeopleIds(tripId);
  if (!people.has(fromId) || !people.has(toId)) return { ok: false, message: "Both people have to be on this trip." };

  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { currency: true } });
  await db.settlement.create({
    data: { tripId, fromId, toId, amount: Math.round(amount * 100) / 100, currency: trip.currency, createdById: user.id },
  });
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true };
}

export async function deleteSettlement(settlementId: string): Promise<Result> {
  const id = z.string().min(1).max(40).parse(settlementId);
  await requireUser(); // signed out: to the login page first, like every action
  const found = await db.settlement.findUnique({ where: { id }, select: { tripId: true } });
  // Same answer for "doesn't exist" and "not your trip"
  if (!found) notFound();
  await requireTripEditor(found.tripId);
  await db.settlement.delete({ where: { id } });
  revalidatePath(`/trips/${found.tripId}`, "layout");
  return { ok: true };
}
