import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteTripButton } from "@/components/trip/delete-trip-button";
import { TripForm } from "@/components/trip/trip-form";
import { Skeleton } from "@/components/ui/skeleton";
import { toDateOnly } from "@/lib/dates";
import { updateTrip } from "@/server/actions/trips";
import { loadEditorTrip } from "@/server/trip-page";

export const metadata: Metadata = { title: "Edit trip" };

export default function EditTripPage({ params }: PageProps<"/trips/[id]/edit">) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="font-heading text-2xl font-extrabold tracking-tight">Edit trip details</h2>
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-2xl" />}>
        <EditTrip params={params} />
      </Suspense>
    </div>
  );
}

async function EditTrip({ params }: { params: Promise<{ id: string }> }) {
  const { trip } = await loadEditorTrip(params, "/edit");
  return (
    <div className="space-y-10">
      <TripForm
        action={updateTrip.bind(null, trip.id)}
        submitLabel="Save changes"
        cancelHref={`/trips/${trip.id}`}
        defaults={{
          title: trip.title,
          types: trip.types,
          startDate: trip.startDate ? toDateOnly(trip.startDate) : "",
          endDate: trip.endDate ? toDateOnly(trip.endDate) : "",
          currency: trip.currency,
          budget: trip.budget === null ? "" : String(trip.budget),
          travellers: String(trip.travellers),
          description: trip.description ?? "",
          coverImageUrl: trip.coverImageUrl ?? "",
        }}
      />
      {/* Only the owner can delete; members can leave from the People panel instead. */}
      {trip.isOwner ? (
        <section className="space-y-3 rounded-2xl border border-destructive/30 p-5">
          <h3 className="font-heading font-extrabold">Delete this trip</h3>
          <p className="text-sm text-muted-foreground">
            Removes the trip and everything in it for good, for everyone planning it.
          </p>
          <DeleteTripButton tripId={trip.id} title={trip.title} />
        </section>
      ) : null}
    </div>
  );
}
