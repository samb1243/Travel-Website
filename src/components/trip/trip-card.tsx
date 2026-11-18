import Link from "next/link";
import { UsersIcon } from "lucide-react";
import { BookingProgress } from "@/components/trip/booking-progress";
import { RouteStrip } from "@/components/trip/route-strip";
import { TripCover } from "@/components/trip/trip-cover";
import { formatDateRange, timingLabel, tripTiming } from "@/lib/format";
import { formatTripTypes, VISIBILITY_META } from "@/lib/trip-types";
import type { TripCardData } from "@/server/trips";
import { cn } from "@/lib/utils";

/** One of your trips: photo first, then the title, route and booking progress. */
export function TripCard({ trip, today }: { trip: TripCardData; today: Date }) {
  const vis = VISIBILITY_META[trip.visibility];
  const VisIcon = vis.icon;
  const timing = tripTiming(trip.startDate, trip.endDate, today);
  const when = timingLabel(timing);
  const dates = formatDateRange(trip.startDate, trip.endDate);

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group block rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
        <TripCover types={trip.types} coverImageUrl={trip.coverImageUrl} className="absolute inset-0" />
        <div className="absolute top-3 right-3 left-3 flex items-start justify-between gap-2">
          {when ? (
            <span
              className={cn(
                "rounded-lg px-2.5 py-1 text-sm font-bold",
                timing.phase === "ongoing" ? "bg-trail text-trail-foreground" : "bg-background/90 text-foreground",
              )}
            >
              {when}
            </span>
          ) : (
            <span />
          )}
          <span className="grid size-8 place-items-center rounded-lg bg-background/90 text-foreground" title={vis.label}>
            <VisIcon className="size-4" aria-label={vis.label} />
          </span>
        </div>
      </div>

      <div className="space-y-3 px-1 pt-3.5">
        <div>
          <h3 className="font-heading text-xl leading-tight font-extrabold text-balance decoration-trail decoration-4 underline-offset-4 group-hover:underline">
            {trip.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatTripTypes(trip.types)}, {dates ?? "no dates yet"}
          </p>
        </div>
        {trip.sharedBy || trip.peopleCount > 1 ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
            {trip.sharedBy
              ? `Shared by ${trip.sharedBy}`
              : `Planning with ${trip.peopleCount - 1} ${trip.peopleCount === 2 ? "other" : "others"}`}
          </p>
        ) : null}
        <RouteStrip names={trip.stopNames} />
        <BookingProgress counts={trip.statusCounts} />
      </div>
    </Link>
  );
}
