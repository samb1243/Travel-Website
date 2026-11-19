import "server-only";
import { rateLimit } from "@/server/rate-limit";

// Place search via OpenStreetMap's Nominatim (free, no API key).
// Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
// at most 1 request per second, identify the app, cache results, and don't
// do search-as-you-type. So: we search on submit only, serialise requests
// with a 1.1 s gap, and cache answers for a day.
//
// Kept behind this small interface so the provider can be swapped later
// (self-hosted Nominatim, Photon, a paid geocoder) without touching the UI.

export type Place = {
  placeId: string; // "osm:relation:62422"
  name: string;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
  label: string; // one-line description for the result list
};

type NominatimResult = {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
};

const BASE_URL = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
const USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? "Tripster/0.1 (trip planner; development)";
const MIN_GAP_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

const cache = new Map<string, { at: number; places: Place[] }>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** Runs `fn` after any earlier request, at least MIN_GAP_MS after the last one. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    // Across all server instances too (each Vercel instance has its own queue):
    // take the shared one-per-second slot, waiting a little if another has it
    for (let tries = 0; !(await rateLimit("nominatim:global", 1, MIN_GAP_MS)); tries++) {
      if (tries >= 4) throw new Error("Place search is busy");
      await new Promise((r) => setTimeout(r, MIN_GAP_MS));
    }
    lastRequestAt = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

function toPlace(r: NominatimResult): Place | null {
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const a = r.address ?? {};
  const name =
    r.name || a.city || a.town || a.village || a.hamlet || a.municipality || r.display_name.split(",")[0];
  const region = a.state || a.region || a.county || a.province || null;
  const country = a.country ?? null;
  const countryCode = a.country_code ? a.country_code.toUpperCase() : null;
  return {
    placeId: `osm:${r.osm_type}:${r.osm_id}`,
    name: name.trim(),
    region,
    country,
    countryCode,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    label: [name, region, country].filter(Boolean).join(", "),
  };
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (q.length < 2) return [];
  const key = q.toLowerCase();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.places;

  const url = new URL("/search", BASE_URL);
  url.search = new URLSearchParams({
    q,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    "accept-language": "en",
  }).toString();

  const results = await throttled(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Place search failed (${res.status})`);
    return (await res.json()) as NominatimResult[];
  });

  // Drop duplicates (same place returned as node + relation, etc.)
  const seen = new Set<string>();
  const places = results
    .map(toPlace)
    .filter((p): p is Place => p !== null)
    .filter((p) => {
      const k = p.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), places });
  return places;
}
