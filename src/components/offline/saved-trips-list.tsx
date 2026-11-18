"use client";

import { useEffect, useState } from "react";
import { LuggageIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readOfflineIndex, savedTripsFrom, type OfflineIndex } from "@/lib/offline";

const TAB_LABEL: Record<string, string> = { "": "Overview", "/itinerary": "Itinerary", "/checklist": "Checklist", "/budget": "Budget", "/map": "Map" };

/**
 * The trips saved on this device. Plain links (not client-side navigation),
 * so each opens as a full page that the service worker can serve offline.
 */
export function SavedTripsList() {
  const [index, setIndex] = useState<OfflineIndex | null | undefined>(undefined);
  useEffect(() => {
    void readOfflineIndex().then(setIndex);
  }, []);

  if (index === undefined) return null;
  const trips = index ? savedTripsFrom(index) : [];

  return (
    <div className="space-y-4">
      {trips.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          No trips saved on this device yet. Next time you&apos;re online, open My trips and your current and upcoming trips
          are saved automatically.
        </p>
      ) : (
        <ul className="space-y-3">
          {trips.map((t) => (
            <li key={t.id} className="space-y-2 rounded-2xl border bg-card p-4">
              <a href={`/trips/${t.id}`} className="flex items-center gap-2 font-heading text-lg font-extrabold hover:underline">
                <LuggageIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                {t.title}
              </a>
              <div className="flex flex-wrap gap-2">
                {Object.keys(TAB_LABEL)
                  .filter((tab) => t.tabs.includes(tab))
                  .map((tab) => (
                    <a
                      key={tab}
                      href={`/trips/${t.id}${tab}`}
                      className="inline-flex h-10 items-center rounded-lg border bg-background px-3 text-sm font-semibold hover:bg-accent"
                    >
                      {TAB_LABEL[tab]}
                    </a>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {index?.pages["/dashboard"] ? (
        <a href="/dashboard" className="inline-block text-sm font-semibold underline-offset-4 hover:underline">
          Open My trips
        </a>
      ) : null}
      <Button type="button" variant="outline" className="h-11" onClick={() => location.reload()}>
        <RefreshCwIcon aria-hidden /> Try again
      </Button>
    </div>
  );
}
