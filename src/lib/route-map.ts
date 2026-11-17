// Turns a trip's stops into points for the map. Pure, so it's unit-tested.

type StopLike = { id: string; name: string; lat: number | null; lng: number | null };

export type RoutePoint = {
  id: string;
  name: string;
  /** 1-based position on the route, counting every stop (with or without a location) */
  number: number;
  lat: number;
  /** Longitude "unwrapped" so the line takes the short way across the 180° meridian */
  lng: number;
};

const valid = (lat: number | null, lng: number | null): boolean =>
  lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Located stops in route order, plus the ones that still need a location.
 * Each longitude is shifted by ±360° when that makes the step from the previous
 * stop shorter, so Tokyo → Honolulu draws over the Pacific, not across Asia.
 */
export function routePoints<T extends StopLike>(stops: T[]): { points: RoutePoint[]; unlocated: (T & { number: number })[] } {
  const points: RoutePoint[] = [];
  const unlocated: (T & { number: number })[] = [];
  stops.forEach((s, i) => {
    if (!valid(s.lat, s.lng)) {
      unlocated.push({ ...s, number: i + 1 });
      return;
    }
    let lng = s.lng!;
    const prev = points.at(-1);
    if (prev) {
      while (lng - prev.lng > 180) lng -= 360;
      while (prev.lng - lng > 180) lng += 360;
    }
    points.push({ id: s.id, name: s.name, number: i + 1, lat: s.lat!, lng });
  });
  return { points, unlocated };
}

/** Great-circle distance in km (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Straight-line length of the whole route, stop to stop, in km. */
export function routeLengthKm(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceKm(points[i - 1], points[i]);
  return total;
}
