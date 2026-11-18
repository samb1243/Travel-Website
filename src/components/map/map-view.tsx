"use client";

import Link from "next/link";
import { useState } from "react";
import { MapIcon, MapPinOffIcon, NavigationIcon, RouteIcon } from "lucide-react";
import { RouteMap } from "@/components/map/route-map";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { parseDateOnly } from "@/lib/dates";
import { formatDateRange, plural } from "@/lib/format";
import { routeLengthKm, routePoints } from "@/lib/route-map";
import { cn } from "@/lib/utils";

export type MapStop = {
  id: string;
  name: string;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  arriveOn: string | null;
  departOn: string | null;
  itemCount: number;
};

const km = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** Opens the place in the phone's maps app (or Google Maps on a computer). */
const mapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;

export function MapView({ tripId, stops, readOnly = false }: { tripId: string; stops: MapStop[]; readOnly?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { points, unlocated } = routePoints(stops);

  if (stops.length === 0) {
    return (
      <EmptyState
        icon={MapIcon}
        title="No stops to map yet"
        action={
          readOnly ? null : (
            <Button asChild size="lg">
              <Link href={`/trips/${tripId}`}>Add your first stop</Link>
            </Button>
          )
        }
      >
        {readOnly ? "This trip doesn't have any stops yet." : "Add stops on the Overview and they'll appear here, joined up in route order."}
      </EmptyState>
    );
  }

  const length = routeLengthKm(points);

  function select(id: string) {
    setSelectedId(id);
    // From the map, bring the matching row into view in the list.
    document.getElementById(`map-stop-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-2">
        {points.length ? (
          <RouteMap
            points={points}
            selectedId={selectedId}
            onSelect={select}
            className="h-[55vh] min-h-72 lg:h-[calc(100vh-14rem)] lg:min-h-[480px]"
          />
        ) : (
          <EmptyState icon={MapPinOffIcon} title="None of the stops have a location">
            Edit a stop on the Overview and search for its place to put it on the map.
          </EmptyState>
        )}
        {points.length > 1 ? (
          <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <RouteIcon className="size-4 shrink-0" aria-hidden />
            About {km.format(length)} km stop to stop, as the crow flies
          </p>
        ) : null}
      </div>

      <section aria-labelledby="map-stops-heading" className="space-y-2">
        <h2 id="map-stops-heading" className="sr-only">
          Stops in route order
        </h2>
        <ol className="space-y-2">
          {stops.map((stop, i) => {
            const located = stop.lat !== null && stop.lng !== null && !unlocated.some((u) => u.id === stop.id);
            const dates = formatDateRange(
              stop.arriveOn ? parseDateOnly(stop.arriveOn) : null,
              stop.departOn ? parseDateOnly(stop.departOn) : null,
            );
            const where = [stop.region, stop.country].filter(Boolean).join(", ");
            const selected = stop.id === selectedId;
            return (
              <li
                key={stop.id}
                id={`map-stop-${stop.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border bg-card p-1.5 pr-2 transition-colors",
                  selected && "border-primary ring-2 ring-primary/30",
                )}
              >
                <button
                  type="button"
                  disabled={!located}
                  onClick={() => select(stop.id)}
                  aria-pressed={selected}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 text-left enabled:hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                      located ? "bg-primary text-primary-foreground" : "border-2 border-dashed text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {stop.name}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {located
                        ? [dates, where || null, stop.itemCount ? plural(stop.itemCount, "booking") : null]
                            .filter(Boolean)
                            .join(" · ")
                        : readOnly
                          ? "No location"
                          : "No location yet: edit it on the Overview to place it"}
                    </span>
                  </span>
                </button>
                {located ? (
                  <a
                    href={mapsUrl(stop.lat!, stop.lng!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid size-11 shrink-0 place-items-center rounded-full border hover:bg-accent"
                    aria-label={`Open ${stop.name} in Google Maps`}
                    title="Open in Google Maps"
                  >
                    <NavigationIcon className="size-4" aria-hidden />
                  </a>
                ) : null}
              </li>
            );
          })}
        </ol>
        {unlocated.length && !readOnly ? (
          <Button asChild variant="outline" className="h-11 w-full">
            <Link href={`/trips/${tripId}`}>Add missing locations on the Overview</Link>
          </Button>
        ) : null}
      </section>
    </div>
  );
}
