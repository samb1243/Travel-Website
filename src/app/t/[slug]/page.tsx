import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarIcon, EyeIcon, MapPinIcon, PencilIcon, UsersIcon } from "lucide-react";
import { SharedTripActions } from "@/components/shared/shared-trip-actions";
import { SharedTripTabs } from "@/components/shared/shared-trip-tabs";
import { TripCover } from "@/components/trip/trip-cover";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDateOnly, toDateOnly } from "@/lib/dates";
import { formatDateRange, plural } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { formatTripTypes, primaryTripType, TRIP_TYPE_META, VISIBILITY_META } from "@/lib/trip-types";
import { getCurrentUser } from "@/server/session";
import { getSharedTrip } from "@/server/shared-trips";

// The read-only page behind a share link: /t/<slug>. Anyone can open public
// and unlisted trips; private trips are "not found" for everyone but the owner.

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  // Same visibility rule as the page: strangers get "not found" for private trips.
  const user = await getCurrentUser();
  const data = await getSharedTrip(slug, user?.id ?? null);
  if (!data) return { title: "Trip not found", robots: { index: false } };
  const { trip } = data;
  const description =
    trip.description?.slice(0, 160) ??
    [trip.durationDays ? plural(trip.durationDays, "day") : null, plural(data.stops.length, "stop"), `by ${trip.authorName}`]
      .filter(Boolean)
      .join(" · ");
  return {
    title: trip.title,
    description,
    // Unlisted trips are for people with the link, not search engines.
    robots: trip.visibility === "PUBLIC" ? undefined : { index: false, follow: false },
    openGraph: {
      title: trip.title,
      description,
      type: "article",
      images: trip.coverImageUrl ? [{ url: trip.coverImageUrl }] : undefined,
    },
  };
}

export default function SharedTripPage({ params }: PageProps<"/t/[slug]">) {
  return (
    <Suspense fallback={<SharedTripSkeleton />}>
      <SharedTripContent params={params} />
    </Suspense>
  );
}

async function SharedTripContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const data = await getSharedTrip(slug, user?.id ?? null);
  if (!data) notFound(); // private or missing: same answer either way

  const { trip } = data;
  const typeMeta = TRIP_TYPE_META[primaryTripType(trip.types)];
  const TypeIcon = typeMeta.icon;
  const vis = VISIBILITY_META[trip.visibility];
  const dates = formatDateRange(
    trip.startDate ? parseDateOnly(trip.startDate) : null,
    trip.endDate ? parseDateOnly(trip.endDate) : null,
  );
  const perPerson = trip.travellers > 1 ? trip.totalCost / trip.travellers : null;

  return (
    <div className="space-y-6">
      {data.canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="flex items-center gap-2">
            <EyeIcon className="size-4 shrink-0 text-primary" aria-hidden />
            {trip.visibility === "PRIVATE"
              ? "Preview: this trip is private, so only you and the people planning it can see this page."
              : `This is what others see. ${vis.label}: ${vis.description.toLowerCase()}.`}
          </p>
          <Button asChild size="sm" variant="outline" className="h-9">
            <Link href={`/trips/${trip.id}`}>
              <PencilIcon aria-hidden /> Back to editing
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-3xl">
        <TripCover types={trip.types} coverImageUrl={trip.coverImageUrl} priority className="aspect-[5/2] sm:aspect-[21/7]" />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <h1 className="font-heading text-[2rem] leading-[0.98] font-black tracking-[-0.02em] text-balance sm:text-5xl">
            {trip.title}
          </h1>
          <p className="flex items-center gap-2.5">
            <UserAvatar name={trip.authorName} image={trip.authorImage} className="size-8" />
            <span>
              by <span className="font-bold">{trip.authorName}</span>
              {trip.copiedFromAuthor ? (
                <span className="text-muted-foreground">, based on {trip.copiedFromAuthor}&apos;s trip</span>
              ) : null}
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-4" aria-hidden />
              {dates ?? "No dates"}
              {trip.durationDays ? <span className="font-normal">({plural(trip.durationDays, "day")})</span> : null}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TypeIcon className="size-4" aria-hidden /> {formatTripTypes(trip.types, 4)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="size-4" aria-hidden />
              {plural(data.stops.length, "stop")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon className="size-4" aria-hidden />
              {plural(trip.travellers, "traveller")}
            </span>
            {trip.totalCost > 0 ? (
              <span className="font-extrabold text-foreground">
                {formatMoney(trip.totalCost, trip.currency)}
                {perPerson !== null ? ` (${formatMoney(perPerson, trip.currency, { compact: true })} pp)` : ""}
              </span>
            ) : null}
          </p>
          {trip.description ? <p className="max-w-2xl text-pretty whitespace-pre-line">{trip.description}</p> : null}
        </div>

        <SharedTripActions
          tripId={trip.id}
          slug={trip.slug}
          title={trip.title}
          startDate={trip.startDate}
          shareable={trip.visibility !== "PRIVATE"}
          signedIn={Boolean(user)}
          isOwner={data.isOwner}
          saved={data.saved}
          saveCount={data.saveCount}
        />
      </div>

      <SharedTripTabs data={data} today={toDateOnly(new Date())} />
    </div>
  );
}

function SharedTripSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="aspect-[5/2] rounded-3xl sm:aspect-[21/7]" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}
