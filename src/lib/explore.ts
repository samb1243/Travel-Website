// Explore filters live in the URL, so filtered views can be shared and work
// without JavaScript:
//   ?type=HIKING&continent=EU&country=FR,IT&minDays=5&maxDays=10&minBudget=500&maxBudget=2000&cur=GBP
// Budgets are per person, in `cur` (the viewer's home currency by default).
// Anything invalid in the URL is ignored rather than causing an error.

import { CURRENCY_CODES } from "@/lib/currencies";
import { CONTINENT_CODES, countriesIn, type Continent } from "@/lib/continents";
import { TRIP_TYPES } from "@/lib/trip-types";
import type { TripType } from "@/generated/prisma/enums";

export const PAGE_SIZE = 24;
/** Most countries you can pick at once */
export const MAX_COUNTRIES = 12;
export const MAX_DAYS = 366;
export const MAX_BUDGET = 1_000_000;

export type ExploreFilters = {
  type: TripType | null;
  continent: Continent | null;
  /** ISO codes; a trip matches if it visits any of them */
  countries: string[];
  minDays: number | null;
  maxDays: number | null;
  /** Per person, in `currency` */
  minBudget: number | null;
  maxBudget: number | null;
  /** The budget's currency; null = the viewer's home currency */
  currency: string | null;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pick = <K extends string>(value: string, keys: readonly K[]) => (keys.includes(value as K) ? (value as K) : null);

/** A whole number from 0 to max, or null */
function whole(value: string, max: number): number | null {
  if (!/^\d{1,7}$/.test(value.trim())) return null;
  const n = Number(value);
  return n <= max ? n : null;
}

export function parseExploreFilters(params: Params): ExploreFilters {
  const continent = pick(one(params.continent).toUpperCase(), CONTINENT_CODES);
  // "FR,IT" or ?country=FR&country=IT
  const raw = (Array.isArray(params.country) ? params.country : [params.country ?? ""]).flatMap((v) => v.split(","));
  let countries = [...new Set(raw.map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))].slice(0, MAX_COUNTRIES);
  // Countries outside the chosen continent don't make sense together with it
  if (continent) countries = countries.filter((c) => countriesIn(continent).includes(c));

  let minDays = whole(one(params.minDays), MAX_DAYS);
  let maxDays = whole(one(params.maxDays), MAX_DAYS);
  if (minDays !== null && maxDays !== null && minDays > maxDays) [minDays, maxDays] = [maxDays, minDays];
  let minBudget = whole(one(params.minBudget), MAX_BUDGET);
  let maxBudget = whole(one(params.maxBudget), MAX_BUDGET);
  if (minBudget !== null && maxBudget !== null && minBudget > maxBudget) [minBudget, maxBudget] = [maxBudget, minBudget];

  const page = Number.parseInt(one(params.page), 10);
  return {
    type: pick(one(params.type), TRIP_TYPES),
    continent,
    countries,
    minDays: minDays || null,
    maxDays: maxDays || null,
    minBudget: minBudget || null,
    maxBudget: maxBudget || null,
    currency: pick(one(params.cur).toUpperCase(), CURRENCY_CODES),
    page: Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

/** Back to a query string, dropping empty values (and page 1). */
export function exploreHref(filters: Partial<ExploreFilters>): string {
  const q = new URLSearchParams();
  if (filters.type) q.set("type", filters.type);
  if (filters.continent) q.set("continent", filters.continent);
  if (filters.countries?.length) q.set("country", filters.countries.join(","));
  if (filters.minDays) q.set("minDays", String(filters.minDays));
  if (filters.maxDays) q.set("maxDays", String(filters.maxDays));
  if (filters.minBudget) q.set("minBudget", String(filters.minBudget));
  if (filters.maxBudget) q.set("maxBudget", String(filters.maxBudget));
  // The currency only matters with a budget
  if (filters.currency && (filters.minBudget || filters.maxBudget)) q.set("cur", filters.currency);
  if (filters.page && filters.page > 1) q.set("page", String(filters.page));
  const s = q.toString();
  return s ? `/explore?${s}` : "/explore";
}

export const hasFilters = (f: ExploreFilters) =>
  Boolean(f.type || f.continent || f.countries.length || f.minDays || f.maxDays || f.minBudget || f.maxBudget);

/** The countries a trip must visit (any of): the picked ones, else the whole continent, else no limit. */
export function countryScope(f: Pick<ExploreFilters, "continent" | "countries">): string[] | null {
  if (f.countries.length) return f.countries;
  if (f.continent) return countriesIn(f.continent);
  return null;
}
