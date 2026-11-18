import Link from "next/link";
import { Suspense } from "react";
import { CalendarIcon, PencilIcon } from "lucide-react";
import { TripCover } from "@/components/trip/trip-cover";
import { PeopleDialog } from "@/components/trip/people-dialog";
import { ShareDialog } from "@/components/trip/share-dialog";
import { TripTabs } from "@/components/trip/trip-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateRange, plural } from "@/lib/format";
import { formatTripTypes, primaryTripType, TRIP_TYPE_META, VISIBILITY_META } from "@/lib/trip-types";
import { getTripPeople } from "@/server/people";
import { loadEditorTrip } from "@/server/trip-page";

export default function TripLayout({ children, params }: LayoutProps<"/trips/[id]">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<TripHeaderSkeleton />}>
        <TripHeader params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function TripHeader({ params }: { params: Promise<{ id: string }> }) {
  const { trip, user } = await loadEditorTrip(params);
  const people = await getTripPeople(trip.id, user.id);
  const typeMeta = TRIP_TYPE_META[primaryTripType(trip.types)];
  const vis = VISIBILITY_META[trip.visibility];
  const VisIcon = vis.icon;
  const TypeIcon = typeMeta.icon;
  const dates = formatDateRange(trip.startDate, trip.endDate);

  // A fragment, not a wrapper: the tabs must be a direct child of the layout's
  // container so they stay stuck under the site header while the page scrolls.
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl">
        <TripCover types={trip.types} coverImageUrl={trip.coverImageUrl} priority className="aspect-[5/2] sm:aspect-[21/7]" />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="font-heading text-[2rem] leading-[0.98] font-black tracking-[-0.02em] text-balance sm:text-5xl">
            {trip.title}
          </h1>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-4" aria-hidden />
              {dates ?? "No dates yet"}
              {trip.durationDays ? <span className="font-normal">({plural(trip.durationDays, "day")})</span> : null}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <TypeIcon className="size-4" aria-hidden /> {formatTripTypes(trip.types, 4)}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <VisIcon className="size-4" aria-hidden /> {vis.label}
            </li>
          </ul>
          {!trip.isOwner ? (
            <p className="text-sm text-muted-foreground">
              Shared with you by <span className="font-semibold text-foreground">{trip.owner.name}</span>
            </p>
          ) : null}
          {trip.copiedFromAuthor ? (
            <p className="text-sm text-muted-foreground">
              Based on {trip.copiedFromAuthor}&apos;s trip “{trip.copiedFromTitle}”
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <PeopleDialog tripId={trip.id} viewerId={user.id} isOwner={trip.isOwner} {...people} />
          {/* Only the owner decides who can see the trip */}
          {trip.isOwner ? <ShareDialog tripId={trip.id} slug={trip.slug} visibility={trip.visibility} /> : null}
          <Button asChild variant="outline" size="lg" className="h-11 rounded-xl border-2 px-4 font-bold">
            <Link href={`/trips/${trip.id}/edit`}>
              <PencilIcon aria-hidden /> Edit
            </Link>
          </Button>
        </div>
      </div>
      <TripTabs basePath={`/trips/${trip.id}`} />
    </>
  );
}

function TripHeaderSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="aspect-[5/2] rounded-3xl sm:aspect-[21/7]" />
      <Skeleton className="h-10 w-2/3 rounded-xl" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
