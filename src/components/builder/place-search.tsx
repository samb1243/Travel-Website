"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { LoaderCircleIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { flagEmoji } from "@/lib/format";
import type { Place } from "@/server/geocode";

/**
 * Search runs when you press Search or Enter, not on every keystroke
 * (OpenStreetMap's free geocoder asks apps not to search as you type).
 */
export function PlaceSearch({ onPick, autoFocus }: { onPick: (place: Place) => void; autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { places?: Place[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.places ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      setPending(false);
    }
  }

  // This sits inside another form, so handle Enter here rather than nesting forms.
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void search();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="City, town, trailhead…"
          aria-label="Search for a place"
          autoFocus={autoFocus}
          enterKeyHint="search"
          className="h-12 text-base md:text-sm"
        />
        <Button type="button" onClick={() => void search()} disabled={pending || query.trim().length < 2} className="h-12 px-4">
          {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <SearchIcon aria-hidden />}
          <span className="sr-only sm:not-sr-only">Search</span>
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {results && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No places found. Try another spelling, or add the stop without a location.</p>
      ) : null}

      {results && results.length > 0 ? (
        <ul className="divide-y overflow-hidden rounded-xl border" aria-label="Search results">
          {results.map((p) => (
            <li key={p.placeId}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="text-lg" aria-hidden>
                  {p.countryCode ? flagEmoji(p.countryCode) : <MapPinIcon className="size-5 text-muted-foreground" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[p.region, p.country].filter(Boolean).join(", ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">Place search © OpenStreetMap contributors</p>
    </div>
  );
}
