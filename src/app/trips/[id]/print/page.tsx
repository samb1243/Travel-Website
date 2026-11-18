import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintToolbar } from "@/components/trip/print-toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { summariseBudget } from "@/lib/budget";
import { parseDateOnly, toDateOnly } from "@/lib/dates";
import { formatDate, formatDateRange, formatItemWhen, plural } from "@/lib/format";
import { CATEGORY_META } from "@/lib/item-categories";
import { buildItinerary, type DayEntry } from "@/lib/itinerary";
import { formatMoney, itemPriceParts } from "@/lib/money";
import { isOpen, PAYMENT_META, STATUS_META } from "@/lib/status";
import { formatTripTypes } from "@/lib/trip-types";
import { loadEditorTrip } from "@/server/trip-page";
import { getTripBuilderData, type BuilderItem } from "@/server/trips";

export const metadata: Metadata = { title: "Print itinerary", robots: { index: false } };

// A print-ready itinerary: open it, then the browser's Print / Save as PDF.
// Editors only (same check as every trip page). Includes confirmation numbers
// and private notes unless ?private=0.

export default function PrintPage({ params, searchParams }: PageProps<"/trips/[id]/print">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[80vh] max-w-3xl rounded-2xl" />}>
      <PrintableTrip params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

async function PrintableTrip({ params, searchParams }: Pick<PageProps<"/trips/[id]/print">, "params" | "searchParams">) {
  const { trip, user } = await loadEditorTrip(params, "/print");
  const [data, query] = await Promise.all([getTripBuilderData(trip.id, user.id), searchParams]);
  if (!data) notFound();
  const showPrivate = query.private !== "0";

  const items = [...data.stops.flatMap((s) => s.items), ...data.tripItems];
  const startDate = trip.startDate ? toDateOnly(trip.startDate) : null;
  const endDate = trip.endDate ? toDateOnly(trip.endDate) : null;
  const itinerary = buildItinerary(items, data.stops, { startDate, endDate });
  const budget = summariseBudget(items, data.stops, {
    budget: trip.budget,
    travellers: trip.travellers,
    durationDays: trip.durationDays,
  });
  const toBook = items.filter((i) => isOpen(i.status));
  const dates = formatDateRange(trip.startDate, trip.endDate);

  return (
    <div className="space-y-4">
      <PrintToolbar tripId={trip.id} showPrivate={showPrivate} />

      {/* The "paper": always dark ink on white, also in dark mode, since it's a print preview */}
      <article className="mx-auto max-w-3xl space-y-8 rounded-2xl bg-white p-6 text-[#14231f] shadow-sm ring-1 ring-black/10 sm:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <header className="space-y-2 border-b-4 border-[#14231f] pb-4">
          <h1 className="font-heading text-3xl leading-tight font-black sm:text-4xl">{trip.title}</h1>
          <p className="text-sm font-semibold text-[#4a5a55]">
            {[formatTripTypes(trip.types, 4), dates, trip.durationDays ? plural(trip.durationDays, "day") : null, plural(trip.travellers, "traveller"), plural(data.stops.length, "stop")]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {trip.description ? <p className="text-sm whitespace-pre-line">{trip.description}</p> : null}
          {showPrivate ? (
            <p className="text-xs text-[#4a5a55]">
              Includes confirmation numbers and private notes. Keep this copy to yourself.
            </p>
          ) : null}
        </header>

        {data.stops.length ? (
          <section className="space-y-2 break-inside-avoid">
            <h2 className="font-heading text-xl font-extrabold">Route</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#14231f] text-left">
                  <th className="py-1.5 pr-2 font-bold">#</th>
                  <th className="py-1.5 pr-2 font-bold">Stop</th>
                  <th className="py-1.5 pr-2 font-bold">Dates</th>
                  <th className="py-1.5 font-bold">Staying at</th>
                </tr>
              </thead>
              <tbody>
                {data.stops.map((s, i) => {
                  const stays = s.items.filter((it) => it.category === "ACCOMMODATION").map((it) => it.title);
                  return (
                    <tr key={s.id} className="border-b border-[#d3ddd8] align-top">
                      <td className="py-1.5 pr-2 font-bold tabular-nums">{i + 1}</td>
                      <td className="py-1.5 pr-2 font-semibold">
                        {s.name}
                        {s.country ? <span className="font-normal text-[#4a5a55]">, {s.country}</span> : null}
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        {formatDateRange(s.arriveOn ? parseDateOnly(s.arriveOn) : null, s.departOn ? parseDateOnly(s.departOn) : null) ?? "—"}
                      </td>
                      <td className="py-1.5">{stays.length ? stays.join("; ") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : null}

        {itinerary.days.length ? (
          <section className="space-y-4">
            <h2 className="font-heading text-xl font-extrabold">Day by day</h2>
            {itinerary.days.map((day) => (
              <div key={day.date} className="break-inside-avoid space-y-1.5 border-t border-[#d3ddd8] pt-3">
                <h3 className="flex flex-wrap items-baseline justify-between gap-x-3 font-bold">
                  <span>
                    {day.dayNumber ? `Day ${day.dayNumber}, ` : ""}
                    {formatDate(parseDateOnly(day.date), { weekday: true })}
                  </span>
                  <span className="text-sm font-semibold text-[#4a5a55]">{day.places.map((p) => p.name).join(" → ")}</span>
                </h3>
                {day.entries.length ? (
                  <ul className="space-y-1.5">
                    {day.entries.map((e) => (
                      <PrintEntry key={`${e.item.id}-${e.kind}`} entry={e} currency={trip.currency} showPrivate={showPrivate} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[#4a5a55]">Nothing planned</p>
                )}
                {day.night ? (
                  <p className="text-sm text-[#4a5a55]">
                    Night:{" "}
                    {day.night.kind === "none"
                      ? "no place to stay added yet"
                      : `${day.night.kind === "stay" ? "" : "on the "}${day.night.item.title}`}
                  </p>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        {itinerary.unscheduled.length ? (
          <section className="break-inside-avoid space-y-2">
            <h2 className="font-heading text-xl font-extrabold">Not tied to a day</h2>
            {itinerary.unscheduled.map((g) => (
              <div key={g.stopId ?? "trip"} className="space-y-1">
                <h3 className="text-sm font-bold">{g.stopName ?? "Whole trip"}</h3>
                <ul className="space-y-1.5">
                  {g.items.map((item) => (
                    <PrintEntry key={item.id} entry={{ item, kind: "single", time: null }} currency={trip.currency} showPrivate={showPrivate} />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        {toBook.length ? (
          <section className="break-inside-avoid space-y-2">
            <h2 className="font-heading text-xl font-extrabold">Still to book or buy</h2>
            <ul className="space-y-1 text-sm">
              {toBook.map((i) => (
                <li key={i.id} className="flex gap-2">
                  <span aria-hidden>☐</span>
                  <span className="flex-1">
                    <span className="font-semibold">{i.title}</span>
                    {i.startAt ? <span className="text-[#4a5a55]"> · {formatItemWhen(i.startAt, i.endAt, i.allDay)}</span> : null}
                  </span>
                  <PrintPrice item={i} currency={trip.currency} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="break-inside-avoid space-y-1 border-t-4 border-[#14231f] pt-3 text-sm">
          <h2 className="font-heading text-xl font-extrabold">Budget</h2>
          <p>
            Planned spend <span className="font-bold">{formatMoney(budget.total, trip.currency)}</span>
            {budget.budget !== null ? ` of ${formatMoney(budget.budget, trip.currency)} budget` : ""}
            {budget.perPerson !== null && trip.travellers > 1
              ? `, ${formatMoney(budget.perPerson, trip.currency, { compact: true })} per person`
              : ""}
            {budget.perDay !== null ? `, ${formatMoney(budget.perDay, trip.currency, { compact: true })} per day` : ""}
          </p>
          <p className="text-xs text-[#4a5a55]">Printed from Tripster on {formatDate(new Date())}</p>
        </section>
      </article>
    </div>
  );
}

function PrintEntry({ entry, currency, showPrivate }: { entry: DayEntry<BuilderItem>; currency: string; showPrivate: boolean }) {
  const { item, kind, time } = entry;
  const meta = CATEGORY_META[item.category];
  const kindLabel = kind === "start" ? meta.labels.start : kind === "end" ? meta.labels.end : meta.label;
  const route = item.fromPlace && item.toPlace ? `${item.fromPlace} → ${item.toPlace}` : null;
  const details = [route && route !== item.title ? route : null, item.provider, item.address].filter(Boolean).join(" · ");

  return (
    <li className="grid grid-cols-[3.25rem_1fr_auto] gap-x-3 text-sm">
      <span className="font-bold tabular-nums">{time ?? ""}</span>
      <span>
        <span className="font-semibold">{item.title}</span>{" "}
        <span className="text-[#4a5a55]">({kindLabel.toLowerCase()})</span>
        {details ? <span className="block text-[#4a5a55]">{details}</span> : null}
        {kind !== "end" ? (
          <>
            {showPrivate && item.confirmationCode ? (
              <span className="block">
                Confirmation: <span className="font-mono font-bold">{item.confirmationCode}</span>
              </span>
            ) : null}
            {item.notes ? <span className="block whitespace-pre-line">{item.notes}</span> : null}
            {showPrivate && item.privateNotes ? <span className="block whitespace-pre-line italic">{item.privateNotes}</span> : null}
            {item.links.filter((l) => showPrivate || l.kind !== "CONFIRMATION").length ? (
              <span className="block text-[#4a5a55]">
                {item.links
                  .filter((l) => showPrivate || l.kind !== "CONFIRMATION")
                  .map((l) => hostOf(l.url))
                  .join(", ")}
              </span>
            ) : null}
          </>
        ) : null}
      </span>
      <span className="text-right">
        {kind !== "end" ? <PrintPrice item={item} currency={currency} /> : null}
        {kind !== "end" ? (
          <span className="block text-xs text-[#4a5a55]">
            {[item.status ? STATUS_META[item.status].label : null, item.payment ? PAYMENT_META[item.payment].label : null]
              .filter(Boolean)
              .join(", ")}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function PrintPrice({ item, currency }: { item: BuilderItem; currency: string }) {
  const parts = itemPriceParts(item.cost, item.currency, currency, item.costInTripCurrency);
  if (!parts) return null;
  return (
    <span className="block tabular-nums">
      {parts.main}
      {parts.converted ? <span className="text-[#4a5a55]"> ({parts.converted})</span> : null}
    </span>
  );
}
