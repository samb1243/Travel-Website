import Link from "next/link";
import { Suspense } from "react";
import { CalendarIcon, PencilIcon } from "lucide-react";
import { TripCover } from "@/components/trip/trip-cover";
import { ShareDialog } from "@/components/trip/share-dialog";
import { TripTabs } from "@/components/trip/trip-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateRange, plural } from "@/lib/format";
import { TRIP_TYPE_META, VISIBILITY_META } from "@/lib/trip-types";
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
  const { trip } = await loadEditorTrip(params);
  const typeMeta = TRIP_TYPE_META[trip.type];
  const vis = VISIBILITY_META[trip.visibility];
  const VisIcon = vis.icon;
  const dates = formatDateRange(trip.startDate, trip.endDate);

  // A fragment, not a wrapper: the tabs must be a direct child of the layout's
  // container so they stay stuck under the site header while the page scrolls.
  return (
    <>
      <div className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl">
        <TripCover type={trip.type} coverImageUrl={trip.coverImageUrl} priority className="aspect-[16/9] sm:aspect-[21/8]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/0" />
        <div className="absolute right-4 bottom-4 left-4 flex items-end justify-between gap-3 text-white sm:right-6 sm:left-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-white/85 uppercase">
              {typeMeta.label}
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 normal-case">
                <VisIcon className="size-3.5" aria-hidden /> {vis.label}
              </span>
            </p>
            <h1 className="font-heading text-2xl leading-tight font-semibold text-balance sm:text-4xl">{trip.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-white/90">
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="size-4" aria-hidden />
                {dates ?? "No dates yet"}
              </span>
              {trip.durationDays ? <span>{plural(trip.durationDays, "day")}</span> : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <ShareDialog tripId={trip.id} slug={trip.slug} visibility={trip.visibility} />
            <Button asChild variant="secondary" size="lg" className="h-10 shrink-0 bg-white/90 text-neutral-900 hover:bg-white">
              <Link href={`/trips/${trip.id}/edit`}>
                <PencilIcon aria-hidden /> <span className="sr-only sm:not-sr-only">Edit</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
      {trip.copiedFromAuthor ? (
        <p className="text-sm text-muted-foreground">
          Based on {trip.copiedFromAuthor}&apos;s trip “{trip.copiedFromTitle}”
        </p>
      ) : null}
      <TripTabs basePath={`/trips/${trip.id}`} />
    </>
  );
}

function TripHeaderSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="-mx-4 aspect-[16/9] rounded-none sm:mx-0 sm:aspect-[21/8] sm:rounded-3xl" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
