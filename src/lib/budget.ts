// Budget numbers for a trip. Pure functions on whole cents (unit-tested), so
// totals never drift. One currency per trip: every cost is in trip.currency.

import { daysBetween, parseDateOnly } from "@/lib/dates";
import { fromCents, toCents } from "@/lib/money";
import { effectivePayment, type ItemStatus, type PaymentStatus } from "@/lib/status";
import type { ItemCategory } from "@/generated/prisma/enums";

type ItemLike = {
  id: string;
  stopId: string | null;
  category: ItemCategory;
  status: ItemStatus | null;
  payment: PaymentStatus | null;
  cost: number | null;
};

/** Payment sections on the budget: UNSET = priced, but nobody said how it's paid */
export const BUDGET_PAYMENT_ORDER = ["PAID", "PAY_ON_ARRIVAL", "TO_PAY", "UNSET"] as const;
export type BudgetPaymentGroup = (typeof BUDGET_PAYMENT_ORDER)[number];
type StopLike = { id: string; name: string; arriveOn: string | null; departOn: string | null };

export type BudgetLevel = "none" | "under" | "near" | "over";

/** At this share of the budget we start warning ("near"). */
export const NEAR_BUDGET = 0.9;

export type BudgetSummary<T> = {
  total: number;
  budget: number | null;
  /** budget - total (negative when over); null without a budget */
  remaining: number | null;
  /** total / budget, e.g. 0.82; null without a (positive) budget */
  usedShare: number | null;
  level: BudgetLevel;
  perPerson: number | null;
  perDay: number | null;
  perPersonPerDay: number | null;
  /** Spend split by payment (bought gear counts as paid), in BUDGET_PAYMENT_ORDER */
  byPayment: { payment: BudgetPaymentGroup; total: number; count: number }[];
  /** Categories with a cost, biggest first */
  byCategory: { category: ItemCategory; total: number; count: number; share: number }[];
  /**
   * Every stop in route order, then "Whole trip" (stopId null) if it has costs.
   * `stayPerNight` is the stop's accommodation cost / nights, so a flight filed
   * under a stop doesn't inflate it.
   */
  byStop: { stopId: string | null; name: string | null; total: number; nights: number | null; stayPerNight: number | null; share: number }[];
  /** The most expensive items, biggest first */
  biggest: T[];
  /** Items with no cost entered yet */
  missingCost: number;
};

const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
const divide = (cents: number, by: number | null) => (by && by > 0 ? fromCents(Math.round(cents / by)) : null);

export function budgetLevel(totalCents: number, budgetCents: number | null): BudgetLevel {
  if (budgetCents === null || budgetCents <= 0) return "none";
  if (totalCents > budgetCents) return "over";
  if (totalCents >= budgetCents * NEAR_BUDGET) return "near";
  return "under";
}

/** Nights at a stop (leave date minus arrive date), or null without both dates. */
export function nightsAt(stop: Pick<StopLike, "arriveOn" | "departOn">): number | null {
  if (!stop.arriveOn || !stop.departOn) return null;
  const n = daysBetween(parseDateOnly(stop.arriveOn), parseDateOnly(stop.departOn));
  return n >= 0 ? n : null;
}

export function summariseBudget<T extends ItemLike>(
  items: T[],
  stops: StopLike[],
  trip: { budget: number | null; travellers: number; durationDays: number | null },
  opts: { biggest?: number } = {},
): BudgetSummary<T> {
  const cents = new Map(items.map((i) => [i.id, toCents(i.cost)]));
  const totalCents = items.reduce((sum, i) => sum + cents.get(i.id)!, 0);
  const budgetCents = trip.budget === null ? null : toCents(trip.budget);
  const travellers = Math.max(1, trip.travellers);
  const days = trip.durationDays && trip.durationDays > 0 ? trip.durationDays : null;

  const priced = items.filter((i) => cents.get(i.id)! > 0);
  const byPayment = BUDGET_PAYMENT_ORDER.map((payment) => {
    const list = priced.filter((i) => (effectivePayment(i) ?? "UNSET") === payment);
    return { payment, total: fromCents(list.reduce((s, i) => s + cents.get(i.id)!, 0)), count: list.length };
  });

  const catTotals = new Map<ItemCategory, { cents: number; count: number }>();
  for (const i of items) {
    if (i.cost === null) continue;
    const entry = catTotals.get(i.category) ?? { cents: 0, count: 0 };
    entry.cents += cents.get(i.id)!;
    entry.count++;
    catTotals.set(i.category, entry);
  }
  const byCategory = [...catTotals]
    .filter(([, v]) => v.cents > 0)
    .sort((a, b) => b[1].cents - a[1].cents)
    .map(([category, v]) => ({ category, total: fromCents(v.cents), count: v.count, share: share(v.cents, totalCents) }));

  const stopIds = new Set(stops.map((s) => s.id));
  const centsForStop = (id: string | null) =>
    items
      .filter((i) => (id === null ? !i.stopId || !stopIds.has(i.stopId) : i.stopId === id))
      .reduce((s, i) => s + cents.get(i.id)!, 0);
  const byStop: BudgetSummary<T>["byStop"] = stops.map((s) => {
    const c = centsForStop(s.id);
    const stayCents = items
      .filter((i) => i.stopId === s.id && i.category === "ACCOMMODATION")
      .reduce((sum, i) => sum + cents.get(i.id)!, 0);
    const nights = nightsAt(s);
    return {
      stopId: s.id,
      name: s.name,
      total: fromCents(c),
      nights,
      stayPerNight: stayCents > 0 ? divide(stayCents, nights) : null,
      share: share(c, totalCents),
    };
  });
  const tripWide = centsForStop(null);
  if (tripWide > 0) {
    byStop.push({ stopId: null, name: null, total: fromCents(tripWide), nights: null, stayPerNight: null, share: share(tripWide, totalCents) });
  }

  const biggest = items
    .filter((i) => cents.get(i.id)! > 0)
    .sort((a, b) => cents.get(b.id)! - cents.get(a.id)!)
    .slice(0, opts.biggest ?? 5);

  return {
    total: fromCents(totalCents),
    budget: budgetCents === null ? null : fromCents(budgetCents),
    remaining: budgetCents === null ? null : fromCents(budgetCents - totalCents),
    usedShare: budgetCents && budgetCents > 0 ? totalCents / budgetCents : null,
    level: budgetLevel(totalCents, budgetCents),
    perPerson: divide(totalCents, travellers),
    perDay: divide(totalCents, days),
    perPersonPerDay: divide(totalCents, days ? days * travellers : null),
    byPayment,
    byCategory,
    byStop,
    biggest,
    missingCost: items.filter((i) => i.cost === null).length,
  };
}
