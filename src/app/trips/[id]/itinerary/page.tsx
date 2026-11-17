import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ItineraryView } from "@/components/itinerary/itinerary-view";
import { Skeleton } from "@/components/ui/skeleton";
import { toDateOnly } from "@/lib/dates";
import { loadEditorTrip } from "@/server/trip-page";
import { getTripBuilderData } from "@/server/trips";

export const metadata: Metadata = { title: "Itinerary" };

export default function ItineraryPage({ params }: PageProps<"/trips/[id]/itinerary">) {
  return (
    <Suspense fallback={<ItinerarySkeleton />}>
      <Itinerary params={params} />
    </Suspense>
  );
}

async function Itinerary({ params }: { params: Promise<{ id: string }> }) {
  const { trip, user } = await loadEditorTrip(params, "/itinerary");
  const data = await getTripBuilderData(trip.id, user.id);
  if (!data) notFound();

  return (
    <ItineraryView
      tripId={trip.id}
      currency={trip.currency}
      today={toDateOnly(new Date())}
      trip={{
        startDate: trip.startDate ? toDateOnly(trip.startDate) : null,
        endDate: trip.endDate ? toDateOnly(trip.endDate) : null,
      }}
      items={[...data.stops.flatMap((s) => s.items), ...data.tripItems]}
      stops={data.stops}
    />
  );
}

function ItinerarySkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Skeleton className="h-14 w-full rounded-2xl" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-2xl" />
      ))}
    </div>
  );
}
