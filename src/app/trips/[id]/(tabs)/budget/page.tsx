import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BudgetView } from "@/components/budget/budget-view";
import { Skeleton } from "@/components/ui/skeleton";
import { loadEditorTrip } from "@/server/trip-page";
import { getTripBuilderData } from "@/server/trips";
import { getTripSplit } from "@/server/split";

export const metadata: Metadata = { title: "Budget" };

export default function BudgetPage({ params }: PageProps<"/trips/[id]/budget">) {
  return (
    <Suspense fallback={<BudgetSkeleton />}>
      <Budget params={params} />
    </Suspense>
  );
}

async function Budget({ params }: { params: Promise<{ id: string }> }) {
  const { trip, user } = await loadEditorTrip(params, "/budget");
  const data = await getTripBuilderData(trip.id, user.id);
  if (!data) notFound();
  // Splitting costs only makes sense with more than one person planning
  const split = await getTripSplit(trip.id);

  return (
    <BudgetView
      tripId={trip.id}
      currency={trip.currency}
      budget={trip.budget}
      travellers={trip.travellers}
      durationDays={trip.durationDays}
      items={[...data.stops.flatMap((s) => s.items), ...data.tripItems]}
      stops={data.stops}
      split={split.people.length > 1 ? { people: split.people, settlements: split.settlements, viewerId: user.id } : null}
    />
  );
}

function BudgetSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-56 w-full rounded-2xl lg:col-span-2" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
