import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BudgetView } from "@/components/budget/budget-view";
import { Skeleton } from "@/components/ui/skeleton";
import { loadEditorTrip } from "@/server/trip-page";
import { getTripBuilderData } from "@/server/trips";

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

  return (
    <BudgetView
      tripId={trip.id}
      currency={trip.currency}
      budget={trip.budget}
      travellers={trip.travellers}
      durationDays={trip.durationDays}
      items={[...data.stops.flatMap((s) => s.items), ...data.tripItems]}
      stops={data.stops}
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
