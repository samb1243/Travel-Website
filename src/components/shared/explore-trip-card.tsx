import Link from "next/link";
import { BookmarkIcon, CalendarIcon, MapPinIcon } from "lucide-react";
import { TripCover } from "@/components/trip/trip-cover";
import { flagEmoji, plural } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { TRIP_TYPE_META } from "@/lib/trip-types";
import type { ExploreCard } from "@/server/shared-trips";

/** Photo card for someone's shared trip (Explore, saved trips). */
export function ExploreTripCard({ trip }: { trip: ExploreCard }) {
  const perPerson = trip.totalCost / Math.max(1, trip.travellers);
  return (
    <Link
      href={`/t/${trip.slug}`}
      className="group block overflow-hidden rounded-3xl border bg-card shadow-sm transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-[4/3]">
        <TripCover type={trip.type} coverImageUrl={trip.coverImageUrl} className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/0" />
        {trip.saveCount ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            <BookmarkIcon className="size-3.5" aria-hidden /> {trip.saveCount}
            <span className="sr-only">{trip.saveCount === 1 ? "save" : "saves"}</span>
          </span>
        ) : null}
        <div className="absolute right-4 bottom-3 left-4 text-white">
          <p className="text-xs font-medium tracking-wide text-white/85 uppercase">{TRIP_TYPE_META[trip.type].label}</p>
          <h3 className="font-heading text-xl leading-tight font-semibold text-balance drop-shadow-sm">{trip.title}</h3>
        </div>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {trip.durationDays ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-4" aria-hidden />
              {plural(trip.durationDays, "day")}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <MapPinIcon className="size-4" aria-hidden />
            {plural(trip.stopCount, "stop")}
          </span>
          {trip.countryCodes.length ? <span aria-label={`Countries: ${trip.countryCodes.join(", ")}`}>{trip.countryCodes.map(flagEmoji).join(" ")}</span> : null}
        </div>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="truncate text-muted-foreground">by {trip.authorName}</span>
          {trip.totalCost > 0 ? (
            <span className="shrink-0 font-medium">
              {formatMoney(perPerson, trip.currency, { compact: true })} <span className="font-normal text-muted-foreground">pp</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
