// Explore filters live in the URL (?type=HIKING&length=week&budget=mid&country=FR)
// so filtered views can be shared and work without JavaScript. Anything
// invalid in the URL is ignored rather than causing an error.

import { TRIP_TYPES } from "@/lib/trip-types";
import type { TripType } from "@/generated/prisma/enums";

export const PAGE_SIZE = 24;

export const LENGTHS = {
  short: { label: "Up to 4 days", min: 1, max: 4 },
  week: { label: "5–10 days", min: 5, max: 10 },
  fortnight: { label: "11–17 days", min: 11, max: 17 },
  long: { label: "18+ days", min: 18, max: null },
} as const;

/** Approximate cost per person in euros (see src/lib/fx.ts). */
export const BUDGETS = {
  low: { label: "Under €750 pp", min: null, max: 750 },
  mid: { label: "€750–2,000 pp", min: 750, max: 2000 },
  high: { label: "€2,000–4,000 pp", min: 2000, max: 4000 },
  luxe: { label: "€4,000+ pp", min: 4000, max: null },
} as const;

export type LengthKey = keyof typeof LENGTHS;
export type BudgetKey = keyof typeof BUDGETS;

export type ExploreFilters = {
  type: TripType | null;
  length: LengthKey | null;
  budget: BudgetKey | null;
  country: string | null;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pick = <K extends string>(value: string, keys: readonly K[]) => (keys.includes(value as K) ? (value as K) : null);

export function parseExploreFilters(params: Params): ExploreFilters {
  const country = one(params.country).trim().toUpperCase();
  const page = Number.parseInt(one(params.page), 10);
  return {
    type: pick(one(params.type), TRIP_TYPES),
    length: pick(one(params.length), Object.keys(LENGTHS) as LengthKey[]),
    budget: pick(one(params.budget), Object.keys(BUDGETS) as BudgetKey[]),
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    page: Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

/** Back to a query string, dropping empty values (and page 1). */
export function exploreHref(filters: Partial<ExploreFilters>): string {
  const q = new URLSearchParams();
  if (filters.type) q.set("type", filters.type);
  if (filters.length) q.set("length", filters.length);
  if (filters.budget) q.set("budget", filters.budget);
  if (filters.country) q.set("country", filters.country);
  if (filters.page && filters.page > 1) q.set("page", String(filters.page));
  const s = q.toString();
  return s ? `/explore?${s}` : "/explore";
}

export const hasFilters = (f: ExploreFilters) => Boolean(f.type || f.length || f.budget || f.country);
