"use client";

import { useState } from "react";
import { CategoryFilter, FilteredOutNote } from "@/components/builder/category-tile";
import { countByGroup, inGroups, type ItemGroup } from "@/lib/item-categories";
import { CalendarDaysIcon, LayoutListIcon, MapIcon, WalletIcon } from "lucide-react";
import { ItemCard } from "@/components/builder/item-card";
import { BudgetView } from "@/components/budget/budget-view";
import { ItineraryView } from "@/components/itinerary/itinerary-view";
import { MapView, type MapStop } from "@/components/map/map-view";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseDateOnly } from "@/lib/dates";
import { formatDateRange } from "@/lib/format";
import type { SharedTrip } from "@/server/shared-trips";

// Four equal tabs that always fit, from the narrowest phone up: no sideways
// scrolling (a scrolling tab bar also scrolls up and down by the active tab's underline).
const TRIGGER = "h-10 min-w-0 gap-1.5 px-1.5";

/** Read-only Route | Days | Map | Budget for a shared trip. */
export function SharedTripTabs({ data, today }: { data: SharedTrip; today: string }) {
  const { trip, stops, tripItems } = data;
  const items = [...stops.flatMap((s) => s.items), ...tripItems];
  // Route tab filter: show only some kinds of item. Empty = everything.
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const show = (list: typeof items) => list.filter((i) => inGroups(i.category, groups));
  const mapStops: MapStop[] = stops.map((s) => ({
    id: s.id,
    name: s.name,
    region: s.region,
    country: s.country,
    countryCode: s.countryCode,
    lat: s.lat,
    lng: s.lng,
    arriveOn: s.arriveOn,
    departOn: s.departOn,
    itemCount: s.items.length,
  }));

  return (
    <Tabs defaultValue="route" className="gap-4">
      <TabsList className="grid w-full grid-cols-4 group-data-horizontal/tabs:h-12">
        <TabsTrigger value="route" className={TRIGGER}>
          <LayoutListIcon aria-hidden /> Route
        </TabsTrigger>
        <TabsTrigger value="days" className={TRIGGER}>
          <CalendarDaysIcon aria-hidden /> Days
        </TabsTrigger>
        <TabsTrigger value="map" className={TRIGGER}>
          <MapIcon aria-hidden /> Map
        </TabsTrigger>
        <TabsTrigger value="budget" className={TRIGGER}>
          <WalletIcon aria-hidden /> Budget
        </TabsTrigger>
      </TabsList>

      <TabsContent value="route">
        {stops.length === 0 && tripItems.length === 0 ? (
          <EmptyState icon={LayoutListIcon} title="Nothing planned yet">
            This trip doesn&apos;t have any stops or bookings yet.
          </EmptyState>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5">
          <CategoryFilter selected={groups} onChange={setGroups} counts={countByGroup(items)} />
          <ol className="space-y-6">
            {stops.map((stop, i) => {
              const dates = formatDateRange(
                stop.arriveOn ? parseDateOnly(stop.arriveOn) : null,
                stop.departOn ? parseDateOnly(stop.departOn) : null,
              );
              return (
                <li key={stop.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-foreground" aria-hidden>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-heading text-xl font-extrabold">
                        {stop.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {[dates, [stop.region, stop.country].filter(Boolean).join(", ") || null].filter(Boolean).join(" · ")}
                      </p>
                      {stop.notes ? <p className="mt-1 text-sm text-pretty whitespace-pre-line">{stop.notes}</p> : null}
                    </div>
                  </div>
                  {groups.length && !show(stop.items).length ? (
                    <div className="pl-12">
                      <FilteredOutNote groups={groups} />
                    </div>
                  ) : null}
                  {show(stop.items).length ? (
                    <div className="space-y-2 pl-12">
                      {show(stop.items).map((item) => (
                        <ItemCard key={item.id} item={item} currency={trip.currency} showStatus={false} />
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
            {show(tripItems).length ? (
              <li className="space-y-3">
                <h3 className="font-heading text-xl font-extrabold">Whole trip</h3>
                <div className="space-y-2">
                  {show(tripItems).map((item) => (
                    <ItemCard key={item.id} item={item} currency={trip.currency} showStatus={false} />
                  ))}
                </div>
              </li>
            ) : null}
          </ol>
          </div>
        )}
      </TabsContent>

      <TabsContent value="days">
        <ItineraryView
          readOnly
          tripId={trip.id}
          currency={trip.currency}
          today={today}
          trip={{ startDate: trip.startDate, endDate: trip.endDate }}
          items={items}
          stops={stops}
        />
      </TabsContent>

      <TabsContent value="map">
        <MapView readOnly tripId={trip.id} stops={mapStops} />
      </TabsContent>

      <TabsContent value="budget">
        <BudgetView
          readOnly
          tripId={trip.id}
          currency={trip.currency}
          budget={trip.budget}
          travellers={trip.travellers}
          durationDays={trip.durationDays}
          items={items}
          stops={stops}
        />
      </TabsContent>
    </Tabs>
  );
}
