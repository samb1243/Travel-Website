import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CompassIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ExploreFilters } from "@/components/shared/explore-filters";
import { ExploreTripCard } from "@/components/shared/explore-trip-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { exploreHref, hasFilters, PAGE_SIZE, parseExploreFilters } from "@/lib/explore";
import { plural } from "@/lib/format";
import { listExploreCountries, listPublicTrips } from "@/server/shared-trips";

export const metadata: Metadata = {
  title: "Explore trips",
  description: "Real trip plans from other travellers. Find one you like and copy it to make it yours.",
};

export default function ExplorePage({ searchParams }: PageProps<"/explore">) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Explore trips</h1>
        <p className="text-muted-foreground">Real routes from other travellers. Copy one and make it yours.</p>
      </div>
      <Suspense fallback={<ExploreSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/explore">, "searchParams">) {
  const filters = parseExploreFilters(await searchParams);
  const [{ trips, total }, countries] = await Promise.all([listPublicTrips(filters), listExploreCountries()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* key: reset the selects when the URL changes (e.g. Clear filters) */}
      <ExploreFilters key={exploreHref({ ...filters, page: 1 })} filters={filters} countries={countries} />

      {trips.length === 0 ? (
        <EmptyState
          icon={CompassIcon}
          title={hasFilters(filters) ? "No trips match those filters" : "No public trips yet"}
          action={
            hasFilters(filters) ? (
              <Button asChild variant="outline" size="lg">
                <Link href="/explore">Clear filters</Link>
              </Button>
            ) : null
          }
        >
          {hasFilters(filters)
            ? "Try a different length or budget, or any country."
            : "When travellers make a trip public, it shows up here for anyone to copy."}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {plural(total, "trip")}
            {hasFilters(filters) ? " match" : ""}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t) => (
              <ExploreTripCard key={t.id} trip={t} />
            ))}
          </div>
          {pages > 1 ? (
            <nav className="flex items-center justify-center gap-3" aria-label="Pages">
              {filters.page > 1 ? (
                <Button asChild variant="outline" className="h-11">
                  <Link href={exploreHref({ ...filters, page: filters.page - 1 })}>
                    <ChevronLeftIcon aria-hidden /> Newer
                  </Link>
                </Button>
              ) : null}
              <span className="text-sm text-muted-foreground">
                Page {filters.page} of {pages}
              </span>
              {filters.page < pages ? (
                <Button asChild variant="outline" className="h-11">
                  <Link href={exploreHref({ ...filters, page: filters.page + 1 })}>
                    Older <ChevronRightIcon aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Budgets are per person and roughly converted to euros so trips in different currencies can be compared.
      </p>
    </div>
  );
}

function ExploreSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
