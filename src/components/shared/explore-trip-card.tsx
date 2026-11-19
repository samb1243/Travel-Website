import Link from "next/link";
import { BookmarkIcon } from "lucide-react";
import { RouteStrip } from "@/components/trip/route-strip";
import { TripCover } from "@/components/trip/trip-cover";
import { plural } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { formatTripTypes } from "@/lib/trip-types";
import type { ExploreCard } from "@/server/shared-trips";

/** Someone's shared trip (Explore, saved trips): photo first, then title, route and price. */
export function ExploreTripCard({ trip }: { trip: ExploreCard }) {
  const perPerson = trip.totalCost / Math.max(1, trip.travellers);
  const facts = [formatTripTypes(trip.types), trip.durationDays ? plural(trip.durationDays, "day") : null]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/t/${trip.slug}`}
      className="group block rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
        <TripCover types={trip.types} coverImageUrl={trip.coverImageUrl} className="absolute inset-0" />
        {trip.saveCount ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-lg bg-background/90 px-2.5 py-1 text-sm font-bold text-foreground">
            <BookmarkIcon className="size-3.5" aria-hidden /> {trip.saveCount}
            <span className="sr-only">{trip.saveCount === 1 ? "save" : "saves"}</span>
          </span>
        ) : null}
      </div>
      <div className="space-y-3 px-1 pt-3.5">
        <div>
          <h2 className="font-heading text-xl leading-tight font-extrabold text-balance decoration-trail decoration-4 underline-offset-4 group-hover:underline">
            {trip.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {facts}, by {trip.authorName}
          </p>
        </div>
        <RouteStrip names={trip.stopNames} />
        {trip.totalCost > 0 ? (
          <p className="text-sm">
            <span className="font-extrabold">{formatMoney(perPerson, trip.currency, { compact: true })}</span>{" "}
            <span className="text-muted-foreground">per person</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
