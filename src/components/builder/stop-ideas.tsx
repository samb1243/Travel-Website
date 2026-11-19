"use client";

import { useState, useTransition } from "react";
import { CheckIcon, LightbulbIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { CategoryTile } from "@/components/builder/category-tile";
import { ItemSheet, type ItemSheetState } from "@/components/builder/item-sheet";
import { ResponsiveSheet } from "@/components/builder/responsive-sheet";
import { Button } from "@/components/ui/button";
import type { BookingDraft } from "@/lib/booking-email";
import { formatMoney } from "@/lib/money";
import { MIN_TRAVELLERS, type Idea } from "@/lib/recommendations";
import { loadStopIdeas } from "@/server/actions/recommendations";
import type { BuilderStop } from "@/server/trips";

type Loaded = { currency: string; ideas: Idea[] };

/** A booking draft from an idea: the place, not anyone's dates, prices or bookings. */
function draftFrom(idea: Idea): BookingDraft {
  return {
    category: idea.category,
    title: idea.title,
    provider: idea.provider ?? "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    fromPlace: "",
    toPlace: "",
    address: idea.address ?? "",
    cost: "",
    currency: "",
    status: "TO_BOOK",
    payment: "",
    confirmationCode: "",
    notes: "",
  };
}

/**
 * "Ideas from other travellers" for one stop: what at least three other people
 * planned here in their public trips. Loaded only when opened.
 */
export function StopIdeas({
  stop,
  currency,
  stops,
  tripId,
}: {
  stop: Pick<BuilderStop, "id" | "name" | "arriveOn">;
  currency: string;
  stops: Pick<BuilderStop, "id" | "name">[];
  tripId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<ItemSheetState>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function show() {
    setOpen(true);
    setError(null);
    start(async () => {
      const result = await loadStopIdeas(stop.id);
      if (!result.ok) return setError(result.message);
      setLoaded({ currency: result.currency, ideas: result.ideas });
    });
  }

  const price = (idea: Idea) =>
    idea.typicalPrice === null
      ? null
      : `about ${formatMoney(idea.typicalPrice, loaded?.currency ?? currency, { compact: true })} ${idea.priceBasis === "night" ? "a night" : "each"}`;

  return (
    <>
      <Button variant="ghost" className="h-11 w-full justify-start rounded-xl font-semibold text-muted-foreground" onClick={show}>
        <LightbulbIcon aria-hidden /> Ideas from other travellers
      </Button>

      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title={`Ideas for ${stop.name}`}
        description={`From public trips: places at least ${MIN_TRAVELLERS} other travellers stayed, ate or went in ${stop.name}.`}
      >
        <div className="space-y-4">
          {pending && !loaded ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden /> Looking at other trips…
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loaded && loaded.ideas.length === 0 ? (
            <p className="rounded-2xl border bg-card p-4 text-sm">
              No ideas for {stop.name} yet. They show up once at least {MIN_TRAVELLERS} travellers have shared trips with the same
              plans here.
            </p>
          ) : null}
          {loaded?.ideas.length ? (
            <ul className="space-y-2">
              {loaded.ideas.map((idea) => {
                const done = idea.alreadyPlanned || added.has(idea.key);
                return (
                  <li key={idea.key} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                    <CategoryTile category={idea.category} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-pretty">{idea.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {[`In ${idea.travellers} travellers' trips`, price(idea), idea.provider].filter(Boolean).join(" · ")}
                      </span>
                      {idea.address ? <span className="block truncate text-xs text-muted-foreground">{idea.address}</span> : null}
                    </span>
                    {done ? (
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
                        <CheckIcon className="size-4" aria-hidden /> {idea.alreadyPlanned ? "In your plans" : "Added"}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 shrink-0"
                        onClick={() => {
                          setAdding(idea.key);
                          setOpen(false);
                          setSheet({ mode: "add", stopId: stop.id, defaultDate: stop.arriveOn ?? "", draft: draftFrom(idea) });
                        }}
                      >
                        <PlusIcon aria-hidden /> Add
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Only public trips count, never private or link-only ones, and nobody&apos;s name, dates or bookings are shown.
          </p>
        </div>
      </ResponsiveSheet>

      <ItemSheet
        tripId={tripId}
        currency={currency}
        stops={stops}
        state={sheet}
        onSaved={() => {
          if (adding) setAdded((s) => new Set(s).add(adding));
        }}
        onClose={() => {
          setSheet(null);
          setAdding(null);
          setOpen(true);
        }}
      />
    </>
  );
}
