"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { ChevronDownIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CURRENCY_CODES } from "@/lib/currencies";
import { CONTINENT_CODES, CONTINENTS, continentOf, type Continent } from "@/lib/continents";
import { exploreHref, hasFilters, MAX_BUDGET, MAX_DAYS, parseExploreFilters, type ExploreFilters as Filters } from "@/lib/explore";
import { TRIP_TYPE_META, TRIP_TYPES } from "@/lib/trip-types";
import { cn } from "@/lib/utils";

const regionName = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code: string) => {
  try {
    return regionName.of(code) ?? code;
  } catch {
    return code;
  }
};

const FIELD =
  "h-11 w-full min-w-0 rounded-xl border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Filters as a plain GET form, so they work without JavaScript; with it, each
 * change applies straight away (typed numbers after a short pause).
 */
export function ExploreFilters({
  filters,
  countries,
  homeCurrency,
}: {
  filters: Filters;
  /** Countries in other people's public trips */
  countries: string[];
  /** Budgets are in this currency unless the URL says otherwise */
  homeCurrency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currency = filters.currency ?? homeCurrency;

  function apply(form: HTMLFormElement) {
    clearTimeout(timer.current);
    const data = new FormData(form);
    const params: Record<string, string | string[]> = {};
    for (const key of new Set(data.keys())) {
      const values = data.getAll(key).map(String);
      params[key] = values.length > 1 ? values : values[0];
    }
    const next = parseExploreFilters(params);
    // Picking a new continent starts the country list again
    if (next.continent !== filters.continent) next.countries = next.countries.filter((c) => continentOf(c) === next.continent);
    startTransition(() => router.push(exploreHref({ ...next, page: 1 }), { scroll: false }));
  }

  const shownCountries = filters.continent ? countries.filter((c) => continentOf(c) === filters.continent) : countries;
  // Continents that have trips, so the list never leads nowhere
  const continents = CONTINENT_CODES.filter((c) => countries.some((code) => continentOf(code) === c) || c === filters.continent);

  return (
    <form
      action="/explore"
      method="get"
      onChange={(e) => {
        const form = e.currentTarget;
        if ((e.target as unknown as HTMLInputElement).type === "number") {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => apply(form), 700);
        } else {
          apply(form);
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      className={cn("space-y-3 rounded-2xl border bg-card/60 p-3 sm:p-4", pending && "opacity-70")}
      aria-label="Filter trips"
    >
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Type</span>
          <select name="type" defaultValue={filters.type ?? ""} className={FIELD}>
            <option value="">Any type</option>
            {TRIP_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRIP_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Continent</span>
          <select name="continent" defaultValue={filters.continent ?? ""} className={FIELD}>
            <option value="">Anywhere</option>
            {continents.map((c: Continent) => (
              <option key={c} value={c}>
                {CONTINENTS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {shownCountries.length ? (
        <details className="group rounded-xl border bg-card" open={filters.countries.length > 0}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>
              Countries
              <span className="ml-1.5 text-muted-foreground">
                {filters.countries.length ? filters.countries.map(countryName).join(", ") : "any"}
              </span>
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <fieldset className="flex flex-wrap gap-2 px-3 pb-3">
            <legend className="sr-only">Countries (pick any)</legend>
            {shownCountries.map((c) => (
              <label
                key={c}
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border bg-background px-3 text-sm font-medium has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input type="checkbox" name="country" value={c} defaultChecked={filters.countries.includes(c)} className="sr-only" />
                {countryName(c)}
              </label>
            ))}
          </fieldset>
        </details>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <fieldset className="min-w-0">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">Length (days)</legend>
          <div className="grid grid-cols-2 gap-2">
            <NumberField name="minDays" label="Min days" placeholder="Min" max={MAX_DAYS} value={filters.minDays} />
            <NumberField name="maxDays" label="Max days" placeholder="Max" max={MAX_DAYS} value={filters.maxDays} />
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">Budget per person</legend>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <NumberField name="minBudget" label="Min budget per person" placeholder="Min" max={MAX_BUDGET} value={filters.minBudget} />
            <NumberField name="maxBudget" label="Max budget per person" placeholder="Max" max={MAX_BUDGET} value={filters.maxBudget} />
            <label>
              <span className="sr-only">Budget currency</span>
              <select name="cur" defaultValue={currency} className={cn(FIELD, "w-24")}>
                {CURRENCY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <noscript>
          <Button type="submit" className="h-11">
            Apply
          </Button>
        </noscript>
        {hasFilters(filters) ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => startTransition(() => router.push("/explore", { scroll: false }))}
          >
            <XIcon aria-hidden /> Clear filters
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function NumberField({
  name,
  label,
  placeholder,
  max,
  value,
}: {
  name: string;
  label: string;
  placeholder: string;
  max: number;
  value: number | null;
}) {
  return (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        name={name}
        inputMode="numeric"
        min={1}
        max={max}
        step={1}
        placeholder={placeholder}
        defaultValue={value ?? ""}
        className={cn(FIELD, "tabular-nums")}
      />
    </label>
  );
}
