"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, BedDoubleIcon, CalendarDaysIcon, CalendarPlusIcon, MoonIcon, SunIcon } from "lucide-react";
import { CopyCode } from "@/components/builder/item-card";
import { ItemSheet, type ItemSheetState } from "@/components/builder/item-sheet";
import { EmptyState } from "@/components/empty-state";
import { Tappable } from "@/components/tappable";
import { Button } from "@/components/ui/button";
import { parseDateOnly } from "@/lib/dates";
import { formatDate, formatItemWhen } from "@/lib/format";
import { CATEGORY_META, LINK_KIND_META, linkButtonLabel } from "@/lib/item-categories";
import { buildItinerary, MAX_DAYS, type DayEntry, type ItineraryDay, type Night } from "@/lib/itinerary";
import { formatPrice } from "@/lib/money";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { BuilderItem, BuilderStop } from "@/server/trips";

const shortDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });

export function ItineraryView({
  tripId,
  currency,
  today,
  trip,
  items,
  stops,
  readOnly = false,
}: {
  tripId: string;
  currency: string;
  /** "YYYY-MM-DD", from the server so server and browser agree */
  today: string;
  trip: { startDate: string | null; endDate: string | null };
  items: BuilderItem[];
  stops: BuilderStop[];
  /** Shared view: no editing */
  readOnly?: boolean;
}) {
  const [sheet, setSheet] = useState<ItemSheetState>(null);
  const { days, unscheduled, truncated } = buildItinerary(items, stops, trip);
  const edit = readOnly ? undefined : (item: BuilderItem) => setSheet({ mode: "edit", item });
  const todayInTrip = days.some((d) => d.date === today && d.dayNumber !== null);

  // Mid-trip, open on today's card (unless the URL already points somewhere).
  useEffect(() => {
    if (!todayInTrip || window.location.hash) return;
    document.getElementById(`day-${today}`)?.scrollIntoView({ block: "start" });
  }, [todayInTrip, today]);

  if (days.length === 0 && unscheduled.length === 0) {
    return (
      <EmptyState
        icon={CalendarDaysIcon}
        title="Your days will show up here"
        action={
          readOnly ? null : <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href={`/trips/${tripId}`}>Add stops and bookings</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/trips/${tripId}/edit`}>Set trip dates</Link>
            </Button>
          </div>
        }
      >
        {readOnly
          ? "This trip doesn't have any dates yet."
          : "Give the trip dates, or add stops and bookings with dates, and you'll get a day-by-day plan."}
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {days.length > 1 ? <DayStrip days={days} today={today} belowTripTabs={!readOnly} /> : null}

      {days.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          Nothing has a date yet. Set the trip dates, or add dates to your stops and bookings, to see them day by day.
        </p>
      ) : null}

      <ol className="space-y-4">
        {days.map((day) => (
          <DayCard key={day.date} day={day} isToday={day.date === today} currency={currency} onEdit={edit} />
        ))}
      </ol>

      {truncated ? (
        <p className="text-sm text-muted-foreground">Showing the first {MAX_DAYS} days. Check the trip dates if that looks wrong.</p>
      ) : null}

      {unscheduled.length ? (
        <section className="space-y-3 rounded-2xl border border-dashed p-4" aria-labelledby="unscheduled-heading">
          <div>
            <h2 id="unscheduled-heading" className="flex items-center gap-2 font-heading text-lg font-semibold">
              <CalendarPlusIcon className="size-5 text-muted-foreground" aria-hidden /> Not scheduled yet
            </h2>
            {readOnly ? null : (
              <p className="text-sm text-muted-foreground">Tap one to give it a date and it moves into the plan.</p>
            )}
          </div>
          {unscheduled.map((group) => (
            <div key={group.stopId ?? "trip"} className="space-y-1">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.stopName ?? "Whole trip"}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = CATEGORY_META[item.category].icon;
                  return (
                    <li key={item.id}>
                      <Tappable
                        onClick={edit && (() => edit(item))}
                        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2"
                        interactiveClassName="hover:bg-accent"
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", STATUS_META[item.status].dot)} aria-hidden />
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        <span className="sr-only">{STATUS_META[item.status].label}</span>
                      </Tappable>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {readOnly ? null : (
        <ItemSheet tripId={tripId} currency={currency} stops={stops} state={sheet} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

/** Sticky row of day chips for jumping around a long trip. */
function DayStrip({
  days,
  today,
  belowTripTabs,
}: {
  days: ItineraryDay<BuilderItem>[];
  today: string;
  /** In the editor the trip tabs are pinned too, so sit below them */
  belowTripTabs: boolean;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  // Keep today's chip in view (sideways only, so the page itself doesn't jump).
  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>("[aria-current=date]");
    if (list && chip) list.scrollLeft = chip.offsetLeft - list.clientWidth / 2 + chip.offsetWidth / 2;
  }, [today]);

  return (
    <nav
      aria-label="Jump to a day"
      className={cn(
        "sticky z-20 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-b-2xl",
        belowTripTabs ? "top-[calc(7rem+1px)]" : "top-16",
      )}
    >
      <ul ref={listRef} className="relative flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {days.map((d) => {
          const isToday = d.date === today;
          return (
            <li key={d.date}>
              <a
                href={`#day-${d.date}`}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "flex h-11 min-w-12 flex-col items-center justify-center rounded-xl border px-2 text-xs leading-tight whitespace-nowrap hover:bg-accent",
                  isToday && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                  d.dayNumber === null && !isToday && "border-dashed text-muted-foreground",
                )}
              >
                <span className="font-semibold">{isToday ? "Today" : d.dayNumber ? `Day ${d.dayNumber}` : "Extra"}</span>
                <span className={cn(!isToday && "text-muted-foreground")}>{shortDay.format(parseDateOnly(d.date))}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DayCard({
  day,
  isToday,
  currency,
  onEdit,
}: {
  day: ItineraryDay<BuilderItem>;
  isToday: boolean;
  currency: string;
  onEdit?: (item: BuilderItem) => void;
}) {
  const date = parseDateOnly(day.date);
  const where = day.places.map((p) => p.name);

  return (
    <li
      id={`day-${day.date}`}
      className={cn("scroll-mt-48 rounded-2xl border bg-card", isToday && "ring-2 ring-primary")}
      aria-label={`${day.dayNumber ? `Day ${day.dayNumber}, ` : ""}${formatDate(date, { weekday: true })}`}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {day.dayNumber ? `Day ${day.dayNumber}` : "Outside the trip dates"}
            {isToday ? <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-primary-foreground normal-case">Today</span> : null}
          </p>
          <h2 className="font-heading text-lg font-semibold">{formatDate(date, { weekday: true })}</h2>
        </div>
        {where.length ? (
          <p className="mt-1 flex min-w-0 flex-wrap items-center justify-end gap-1 text-right text-sm font-medium">
            {where.map((name, i) => (
              <span key={name + i} className="inline-flex items-center gap-1">
                {i > 0 ? <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-label="then" /> : null}
                {name}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 p-3">
        {day.entries.length ? (
          <ol className="space-y-2">
            {day.entries.map((entry) => (
              <Entry key={`${entry.item.id}-${entry.kind}`} entry={entry} currency={currency} onEdit={onEdit && (() => onEdit(entry.item))} />
            ))}
          </ol>
        ) : (
          <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
            <SunIcon className="size-4" aria-hidden />
            {where.length ? `Free day in ${where.at(-1)}` : "Nothing planned"}
          </p>
        )}
        {day.night ? <NightLine night={day.night} /> : null}
      </div>
    </li>
  );
}

function Entry({ entry, currency, onEdit }: { entry: DayEntry<BuilderItem>; currency: string; onEdit?: () => void }) {
  const { item, kind, time } = entry;
  const meta = CATEGORY_META[item.category];
  const status = STATUS_META[item.status];
  const Icon = meta.icon;
  const kindLabel = kind === "start" ? meta.labels.start : kind === "end" ? meta.labels.end : null;
  const route = item.fromPlace && item.toPlace ? `${item.fromPlace} → ${item.toPlace}` : null;
  // A single entry that spans days (rail pass) shows its full range.
  const range = kind === "single" && item.endAt && item.endAt.slice(0, 10) !== item.startAt?.slice(0, 10)
    ? formatItemWhen(item.startAt, item.endAt, item.allDay)
    : null;
  const details = [kindLabel, route && route !== item.title ? route : null, range, item.provider].filter(Boolean).join(" · ");
  const showExtras = kind !== "end" && (item.links.length > 0 || item.confirmationCode);

  return (
    <li className="flex gap-3">
      <span className="w-12 shrink-0 pt-3 text-right text-sm font-medium tabular-nums text-muted-foreground">
        {time ?? (item.allDay && item.category === "ACTIVITY" ? "All day" : "")}
      </span>
      <div className={cn("min-w-0 flex-1 rounded-xl border border-l-4 bg-background", status.border, kind === "end" && "bg-muted/40")}>
        <Tappable
          onClick={onEdit}
          label={`Edit ${item.title}`}
          className="flex w-full items-start gap-2.5 rounded-xl p-2.5"
          interactiveClassName="hover:bg-accent/40"
        >
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={meta.label} />
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2">
              <span className="font-medium text-pretty">{item.title}</span>
              {item.cost !== null && kind !== "end" ? (
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatPrice(item.cost, currency)}</span>
              ) : null}
            </span>
            {details ? <span className="block text-sm text-muted-foreground">{details}</span> : null}
            {item.status === "TO_BOOK" || item.status === "PAY_ON_ARRIVAL" ? (
              <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", status.badge)}>
                <span aria-hidden>{status.emoji}</span> {status.label}
              </span>
            ) : null}
          </span>
        </Tappable>
        {showExtras ? (
          <div className="flex flex-wrap gap-2 px-2.5 pb-2.5">
            {item.confirmationCode ? <CopyCode code={item.confirmationCode} /> : null}
            {item.links.map((l) => {
              const LinkIcon = LINK_KIND_META[l.kind].icon;
              return (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-medium hover:bg-accent"
                >
                  <LinkIcon className="size-4 text-muted-foreground" aria-hidden />
                  {linkButtonLabel(l)}
                </a>
              );
            })}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function NightLine({ night }: { night: Night<BuilderItem> }) {
  if (night.kind === "none") {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <MoonIcon className="size-4 shrink-0" aria-hidden /> No place to stay added for tonight
      </p>
    );
  }
  const Icon = night.kind === "stay" ? BedDoubleIcon : CATEGORY_META[night.item.category].icon;
  return (
    <p className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">
        {night.kind === "stay" ? "Night at " : "Overnight on "}
        <span className="font-medium text-foreground">{night.item.title}</span>
      </span>
    </p>
  );
}
