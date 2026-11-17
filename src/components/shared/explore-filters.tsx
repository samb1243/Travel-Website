"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUDGETS, exploreHref, hasFilters, LENGTHS, type ExploreFilters as Filters } from "@/lib/explore";
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

const SELECT =
  "h-11 w-full min-w-0 rounded-xl border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Filters as a plain GET form, so they work without JavaScript; with it,
 * each change applies straight away.
 */
export function ExploreFilters({ filters, countries }: { filters: Filters; countries: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const get = (k: string) => (String(data.get(k) ?? "") || null) as never;
    startTransition(() =>
      router.push(exploreHref({ type: get("type"), length: get("length"), budget: get("budget"), country: get("country") }), {
        scroll: false,
      }),
    );
  }

  return (
    <form
      action="/explore"
      method="get"
      onChange={(e) => apply(e.currentTarget)}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center", pending && "opacity-70")}
      aria-label="Filter trips"
    >
      <label className="lg:w-44">
        <span className="sr-only">Trip type</span>
        <select name="type" defaultValue={filters.type ?? ""} className={SELECT}>
          <option value="">Any type</option>
          {TRIP_TYPES.map((t) => (
            <option key={t} value={t}>
              {TRIP_TYPE_META[t].label}
            </option>
          ))}
        </select>
      </label>
      <label className="lg:w-40">
        <span className="sr-only">Length</span>
        <select name="length" defaultValue={filters.length ?? ""} className={SELECT}>
          <option value="">Any length</option>
          {Object.entries(LENGTHS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <label className="lg:w-48">
        <span className="sr-only">Budget per person</span>
        <select name="budget" defaultValue={filters.budget ?? ""} className={SELECT}>
          <option value="">Any budget</option>
          {Object.entries(BUDGETS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <label className="lg:w-48">
        <span className="sr-only">Country</span>
        <select name="country" defaultValue={filters.country ?? ""} className={SELECT}>
          <option value="">Any country</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {countryName(c)}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <Button type="submit" className="h-11">
          Apply
        </Button>
      </noscript>
      {hasFilters(filters) ? (
        <Button
          type="button"
          variant="ghost"
          className="col-span-2 h-11 sm:col-span-4 lg:col-span-1"
          onClick={() => startTransition(() => router.push("/explore", { scroll: false }))}
        >
          <XIcon aria-hidden /> Clear filters
        </Button>
      ) : null}
    </form>
  );
}
