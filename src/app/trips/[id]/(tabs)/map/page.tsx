import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MapView, type MapStop } from "@/components/map/map-view";
import { Skeleton } from "@/components/ui/skeleton";
import { loadEditorTrip } from "@/server/trip-page";
import { getTripBuilderData } from "@/server/trips";

export const metadata: Metadata = { title: "Map" };

export default function MapPage({ params }: PageProps<"/trips/[id]/map">) {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <TripMap params={params} />
    </Suspense>
  );
}

async function TripMap({ params }: { params: Promise<{ id: string }> }) {
  const { trip, user } = await loadEditorTrip(params, "/map");
  const data = await getTripBuilderData(trip.id, user.id);
  if (!data) notFound();

  // Only what the map needs: no item details, confirmation numbers or notes.
  const stops: MapStop[] = data.stops.map((s) => ({
    id: s.id,
    name: s.name,
    region: s.region,
    country: s.country,
    countryCode: s.countryCode,
    lat: s.lat,
    lng: s.lng,
    arriveOn: s.arriveOn,
    departOn: s.departOn,
    itemCount: s.items.length,
  }));

  return <MapView tripId={trip.id} stops={stops} />;
}

function MapSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Skeleton className="h-[55vh] min-h-72 w-full rounded-2xl lg:h-[calc(100vh-14rem)]" />
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
