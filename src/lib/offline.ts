// Read-only offline access: the browser side of public/sw.js.
//
// Your current and upcoming trips (and any trip page you open) are kept on
// this device so they open with no signal. Changes still need a connection.
// Everything saved is deleted when you sign out, or when someone else signs
// in on the same device.

/** Must match public/sw.js (checked by offline.test.ts) */
export const OFFLINE_CACHE_VERSION = "v1";
export const PAGES_CACHE = `tripster-pages-${OFFLINE_CACHE_VERSION}`;
export const IMAGES_CACHE = `tripster-images-${OFFLINE_CACHE_VERSION}`;
export const DOCS_CACHE = `tripster-docs-${OFFLINE_CACHE_VERSION}`;
export const INDEX_URL = "/__offline-index";

/** How many trips are saved in the background */
export const MAX_OFFLINE_TRIPS = 8;
/** Trip tabs saved for each trip (the map needs a connection for its tiles anyway) */
export const OFFLINE_TABS = ["", "/itinerary", "/checklist", "/budget"] as const;
/** Save again in the background when the last save is older than this */
export const RESAVE_AFTER_MS = 6 * 60 * 60 * 1000;

export type OfflinePage = { path: string; title: string | null };

export type OfflineIndex = {
  user: string | null;
  savedAt: number | null;
  pages: Record<string, { savedAt: number; title: string | null }>;
};

/** The pages to keep for a list of trips: My trips, then each trip's tabs. */
export function offlinePagesFor(trips: { id: string; title: string }[]): OfflinePage[] {
  return [
    { path: "/dashboard", title: "My trips" },
    ...trips.slice(0, MAX_OFFLINE_TRIPS).flatMap((t) => OFFLINE_TABS.map((tab) => ({ path: `/trips/${t.id}${tab}`, title: t.title }))),
  ];
}

/** Saved trips from the index, newest first, with which of their tabs are saved. */
export function savedTripsFrom(index: OfflineIndex): { id: string; title: string; tabs: string[]; savedAt: number }[] {
  const trips = new Map<string, { id: string; title: string; tabs: string[]; savedAt: number }>();
  for (const [path, entry] of Object.entries(index.pages)) {
    const m = /^\/trips\/([A-Za-z0-9_-]+)(\/[a-z]+)?$/.exec(path);
    if (!m) continue;
    const trip = trips.get(m[1]) ?? { id: m[1], title: entry.title ?? "Trip", tabs: [], savedAt: 0 };
    trip.tabs.push(m[2] ?? "");
    if (entry.title) trip.title = entry.title;
    trip.savedAt = Math.max(trip.savedAt, entry.savedAt);
    trips.set(m[1], trip);
  }
  return [...trips.values()].sort((a, b) => b.savedAt - a.savedAt);
}

export const offlineSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window;

/** Sends a message to the active service worker and waits for its reply. */
async function ask<T>(message: unknown, timeoutMs = 60_000): Promise<T | null> {
  if (!offlineSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  if (!reg.active) return null;
  return new Promise<T | null>((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data as T);
    };
    reg.active!.postMessage(message, [channel.port2]);
  });
}

export function saveForOffline(user: string, pages: OfflinePage[]) {
  return ask<{ ok: boolean; saved: number; failed: number }>({ type: "save", user, pages }, 180_000);
}

/** Forgets every saved page and photo on this device (used when signing out). */
export async function clearOffline() {
  if (!offlineSupported()) return;
  // Straight from the page too, in case the service worker isn't running
  await Promise.all([caches.delete(PAGES_CACHE), caches.delete(IMAGES_CACHE), caches.delete(DOCS_CACHE)]).catch(() => {});
  await ask({ type: "clear" }, 5_000).catch(() => null);
}

export async function readOfflineIndex(): Promise<OfflineIndex | null> {
  if (typeof window === "undefined" || !("caches" in window)) return null;
  try {
    const res = await (await caches.open(PAGES_CACHE)).match(INDEX_URL);
    return res ? ((await res.json()) as OfflineIndex) : null;
  } catch {
    return null;
  }
}
