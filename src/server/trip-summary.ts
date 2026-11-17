// Recalculates Trip.durationDays / countryCodes / totalCost.
// Call `refreshTripSummary` after any write to a trip's dates, stops or items.
// Deliberately has no `server-only` import so the seed script can use it.

import type { PrismaClient } from "@/generated/prisma/client";
import { daysBetween } from "@/lib/dates";
import { approxEur } from "@/lib/fx";
import { sumMoney, type MoneyLike } from "@/lib/money";

export type SummaryInput = {
  startDate: Date | null;
  endDate: Date | null;
  stops: { countryCode: string | null; arriveOn: Date | null; departOn: Date | null }[];
  items: { cost: MoneyLike | null }[];
  /** Used for the approximate per-person euro figure Explore filters on */
  currency?: string;
  travellers?: number;
};

export type TripSummary = {
  durationDays: number | null;
  countryCodes: string[];
  totalCost: number;
  /** Rough cost per person in euros (src/lib/fx.ts), only for Explore's budget filter */
  costPerPersonEur: number | null;
};

export function computeTripSummary(input: SummaryInput): TripSummary {
  // Prefer the trip's own dates; otherwise span the stop dates.
  let start = input.startDate;
  let end = input.endDate;
  if (!start || !end) {
    const stopDates = input.stops
      .flatMap((s) => [s.arriveOn, s.departOn])
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    start ??= stopDates[0] ?? null;
    end ??= stopDates.at(-1) ?? null;
  }
  const durationDays =
    start && end && end >= start ? daysBetween(start, end) + 1 : null;

  const countryCodes = [
    ...new Set(
      input.stops
        .map((s) => s.countryCode?.trim().toUpperCase())
        .filter((c): c is string => !!c),
    ),
  ];

  // Every item counts, including "no booking needed" ones (walk-ins still cost money).
  const totalCost = sumMoney(input.items.map((i) => i.cost));

  const perPerson = totalCost / Math.max(1, input.travellers ?? 1);
  const costPerPersonEur = approxEur(perPerson, input.currency ?? "EUR");

  return { durationDays, countryCodes, totalCost, costPerPersonEur };
}

type Db = Pick<PrismaClient, "trip">;

export async function refreshTripSummary(db: Db, tripId: string): Promise<TripSummary> {
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: {
      startDate: true,
      endDate: true,
      currency: true,
      travellers: true,
      stops: { select: { countryCode: true, arriveOn: true, departOn: true } },
      items: { select: { cost: true } },
    },
  });
  const summary = computeTripSummary(trip);
  await db.trip.update({ where: { id: tripId }, data: summary });
  return summary;
}
