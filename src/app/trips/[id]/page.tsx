import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MapPinIcon } from "lucide-react";
import { RouteBuilder } from "@/components/builder/route-builder";
import { FlashToast } from "@/components/flash-toast";
import { BookingProgress } from "@/components/trip/booking-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toDateOnly } from "@/lib/dates";
import { flagEmoji, plural } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { loadEditorTrip } from "@/server/trip-page";
import { getTripBuilderData } from "@/server/trips";

export const metadata: Metadata = { title: "Trip overview" };

export default function TripOverviewPage({ params, searchParams }: PageProps<"/trips/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <Overview params={params} />
      <CopiedFlash searchParams={searchParams} />
    </Suspense>
  );
}

async function CopiedFlash({ searchParams }: Pick<PageProps<"/trips/[id]">, "searchParams">) {
  const { copied } = await searchParams;
  return copied ? <FlashToast message="Trip copied. Everything is set to To book, ready for your own bookings." /> : null;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-heading text-lg font-semibold">{children}</dd>
    </div>
  );
}

async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { trip, user } = await loadEditorTrip(params);
  const builder = await getTripBuilderData(trip.id, user.id);
  if (!builder) notFound();
  const overBudget = trip.budget !== null && trip.totalCost > trip.budget;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        {trip.description ? (
          <p className="text-pretty whitespace-pre-line text-muted-foreground">{trip.description}</p>
        ) : null}

        <RouteBuilder
          tripId={trip.id}
          currency={trip.currency}
          tripStart={trip.startDate ? toDateOnly(trip.startDate) : null}
          stops={builder.stops}
          tripItems={builder.tripItems}
        />
      </div>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-heading font-semibold">Bookings</h2>
          <BookingProgress counts={trip.statusCounts} size="lg" />
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <Fact label="Length">{trip.durationDays ? plural(trip.durationDays, "day") : "—"}</Fact>
          <Fact label="Stops">{trip._count.stops}</Fact>
          <Fact label="Travellers">{trip.travellers}</Fact>
          <Fact label="Countries">
            {trip.countryCodes.length ? trip.countryCodes.map(flagEmoji).join(" ") : "—"}
          </Fact>
          <div className="col-span-2 rounded-2xl border bg-card p-4">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Planned spend</dt>
            <dd className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-heading text-lg font-semibold">{formatMoney(trip.totalCost, trip.currency)}</span>
              {trip.budget !== null ? (
                <span className={overBudget ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                  of {formatMoney(trip.budget, trip.currency)} budget
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">No budget set</span>
              )}
            </dd>
          </div>
        </dl>
        {trip.stops.length === 0 && trip._count.items === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            Tip: the Itinerary, Checklist, Map and Budget tabs fill in as you add stops and bookings.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
