import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChecklistView } from "@/components/checklist/checklist-view";
import { Skeleton } from "@/components/ui/skeleton";
import { toDateOnly } from "@/lib/dates";
import { loadEditorTrip } from "@/server/trip-page";
import { getTripBuilderData } from "@/server/trips";

export const metadata: Metadata = { title: "Checklist" };

export default function ChecklistPage({ params }: PageProps<"/trips/[id]/checklist">) {
  return (
    <Suspense fallback={<ChecklistSkeleton />}>
      <Checklist params={params} />
    </Suspense>
  );
}

async function Checklist({ params }: { params: Promise<{ id: string }> }) {
  const { trip, user } = await loadEditorTrip(params, "/checklist");
  const data = await getTripBuilderData(trip.id, user.id);
  if (!data) notFound();

  // Items already come sorted by time; the checklist regroups them by status.
  const items = [...data.stops.flatMap((s) => s.items), ...data.tripItems];
  const stops = data.stops.map(({ id, name, arriveOn }) => ({ id, name, arriveOn }));

  return (
    <ChecklistView
      tripId={trip.id}
      currency={trip.currency}
      today={toDateOnly(new Date())}
      items={items}
      stops={stops}
    />
  );
}

function ChecklistSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Skeleton className="h-28 w-full rounded-2xl" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  );
}
