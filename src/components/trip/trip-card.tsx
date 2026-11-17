import Link from "next/link";
import { CalendarIcon, MapPinIcon } from "lucide-react";
import { BookingProgress } from "@/components/trip/booking-progress";
import { TripCover } from "@/components/trip/trip-cover";
import { flagEmoji, formatDateRange, plural, timingLabel, tripTiming } from "@/lib/format";
import { TRIP_TYPE_META, VISIBILITY_META } from "@/lib/trip-types";
import type { TripCardData } from "@/server/trips";
import { cn } from "@/lib/utils";

export function TripCard({ trip, today }: { trip: TripCardData; today: Date }) {
  const typeMeta = TRIP_TYPE_META[trip.type];
  const vis = VISIBILITY_META[trip.visibility];
  const VisIcon = vis.icon;
  const timing = tripTiming(trip.startDate, trip.endDate, today);
  const when = timingLabel(timing);
  const dates = formatDateRange(trip.startDate, trip.endDate);

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group block overflow-hidden rounded-3xl border bg-card shadow-sm transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-[4/3]">
        <TripCover type={trip.type} coverImageUrl={trip.coverImageUrl} className="absolute inset-0" />
        {/* Scrim keeps the overlay text readable on any photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/0" />
        <div className="absolute top-3 right-3 left-3 flex items-start justify-between gap-2">
          {when ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur",
                timing.phase === "ongoing" ? "bg-primary text-primary-foreground" : "bg-black/35 text-white",
              )}
            >
              {when}
            </span>
          ) : (
            <span />
          )}
          <span className="grid size-7 place-items-center rounded-full bg-black/35 text-white backdrop-blur" title={vis.label}>
            <VisIcon className="size-3.5" aria-label={vis.label} />
          </span>
        </div>
        <div className="absolute right-4 bottom-3 left-4 text-white">
          <p className="text-xs font-medium tracking-wide text-white/85 uppercase">{typeMeta.label}</p>
          <h3 className="font-heading text-xl leading-tight font-semibold text-balance drop-shadow-sm">{trip.title}</h3>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="size-4" aria-hidden />
            {dates ?? "No dates yet"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPinIcon className="size-4" aria-hidden />
            {plural(trip.stopCount, "stop")}
          </span>
          {trip.countryCodes.length ? (
            <span aria-label={`Countries: ${trip.countryCodes.join(", ")}`}>
              {trip.countryCodes.slice(0, 6).map(flagEmoji).join(" ")}
            </span>
          ) : null}
        </div>
        <BookingProgress counts={trip.statusCounts} />
      </div>
    </Link>
  );
}
