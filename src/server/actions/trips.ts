"use server";

import { getRates } from "@/server/rates";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { makeTripSlug } from "@/lib/slug";
import { fieldErrors } from "@/lib/validation/common";
import { tripFormValues, tripSchema } from "@/lib/validation/trip";
import { requireTripEditor, requireTripOwner } from "@/server/permissions";
import { requireUser } from "@/server/session";
import { checkNewTripAllowed } from "@/server/trip-limits";
import { refreshTripSummary } from "@/server/trip-summary";

export type TripFormState = { errors?: Record<string, string>; message?: string };


// Server actions are public HTTP endpoints. Every one re-checks the user and
// their access to the trip, and validates input, regardless of the UI.

export async function createTrip(_prev: TripFormState, formData: FormData): Promise<TripFormState> {
  const user = await requireUser();
  const parsed = tripSchema.safeParse(tripFormValues(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const limited = await checkNewTripAllowed(user.id);
  if (limited) return { message: limited };

  const trip = await db.trip.create({
    data: { ...parsed.data, ownerId: user.id, slug: makeTripSlug(parsed.data.title) },
    select: { id: true },
  });
  await refreshTripSummary(db, trip.id, (await getRates()).table);

  revalidatePath("/dashboard");
  redirect(`/trips/${trip.id}`);
}

export async function updateTrip(
  tripId: string,
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  await requireTripEditor(tripId);
  const parsed = tripSchema.safeParse(tripFormValues(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // The slug is deliberately left alone so existing share links keep working.
  const before = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { currency: true } });
  const newCurrency = parsed.data.currency;
  await db.$transaction(async (tx) => {
    if (newCurrency !== before.currency) {
      // Prices without their own currency were in the old trip currency: keep them
      // that way (a $100 hostel stays $100, converted), rather than letting them
      // silently become €100. Prices already in the new currency need no tag.
      await tx.item.updateMany({ where: { tripId, currency: null }, data: { currency: before.currency } });
      await tx.item.updateMany({ where: { tripId, currency: newCurrency }, data: { currency: null } });
    }
    await tx.trip.update({ where: { id: tripId }, data: parsed.data });
  });
  await refreshTripSummary(db, tripId, (await getRates()).table);

  revalidatePath("/dashboard");
  revalidatePath(`/trips/${tripId}`, "layout");
  redirect(`/trips/${tripId}`);
}

/** Owner only: members can leave a trip, but not delete it for everyone. */
export async function deleteTrip(tripId: string): Promise<void> {
  await requireTripOwner(tripId);
  // Stops, items, links and saves cascade. Copies of this trip keep their
  // "based on" credit text but lose the link (onDelete: SetNull).
  await db.trip.delete({ where: { id: tripId } });

  revalidatePath("/dashboard");
  redirect("/dashboard?deleted=1");
}
