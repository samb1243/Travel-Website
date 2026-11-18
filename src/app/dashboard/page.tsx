import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompassIcon, LuggageIcon, PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FlashToast } from "@/components/flash-toast";
import { TripCard } from "@/components/trip/trip-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDateOnly, toDateOnly } from "@/lib/dates";
import { tripTiming } from "@/lib/format";
import { requireUser } from "@/server/session";
import { listMyTrips, type TripCardData } from "@/server/trips";
import { listSavedTrips } from "@/server/shared-trips";
import { ExploreTripCard } from "@/components/shared/explore-trip-card";

export const metadata: Metadata = { title: "My trips" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const user = await requireUser("/dashboard");
  const [trips, saved, params] = await Promise.all([listMyTrips(user.id), listSavedTrips(user.id), searchParams]);
  const firstName = user.name.split(" ")[0];
  const today = parseDateOnly(toDateOnly(new Date()));

  const current: TripCardData[] = [];
  const past: TripCardData[] = [];
  for (const t of trips) {
    (tripTiming(t.startDate, t.endDate, today).phase === "past" ? past : current).push(t);
  }
  past.reverse(); // most recent first

  return (
    <div className="space-y-8">
      {params.deleted ? <FlashToast message="Trip deleted" /> : null}
      {params.left ? <FlashToast message="You left the trip" /> : null}

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground">Hi {firstName} 👋</p>
          <h1 className="font-heading text-4xl leading-none font-black tracking-[-0.02em] md:text-5xl">My trips</h1>
        </div>
        {trips.length ? (
          <Button asChild size="lg" className="h-11">
            <Link href="/trips/new">
              <PlusIcon aria-hidden /> New trip
            </Link>
          </Button>
        ) : null}
      </div>

      {trips.length === 0 ? (
        <EmptyState
          icon={LuggageIcon}
          title="Plan your first trip"
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6">
                <Link href="/trips/new">
                  <PlusIcon aria-hidden /> Start a trip
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6">
                <Link href="/explore">
                  <CompassIcon aria-hidden /> Copy one from Explore
                </Link>
              </Button>
            </div>
          }
        >
          Start from scratch, or copy a public trip someone else has already planned and make it yours.
        </EmptyState>
      ) : (
        <>
          {current.length ? <TripGrid title="Upcoming" trips={current} today={today} /> : null}
          {past.length ? <TripGrid title="Past trips" trips={past} today={today} /> : null}
        </>
      )}

      {saved.length ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-xl font-extrabold">Saved from Explore</h2>
            <Link href="/explore" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Find more
            </Link>
          </div>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((t) => (
              <ExploreTripCard key={t.id} trip={t} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TripGrid({ title, trips, today }: { title: string; trips: TripCardData[]; today: Date }) {
  return (
    <section className="space-y-4">
      <h2 className="font-heading text-xl font-extrabold">{title}</h2>
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((t) => (
          <TripCard key={t.id} trip={t} today={today} />
        ))}
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <Skeleton className="h-14 w-48" />
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
