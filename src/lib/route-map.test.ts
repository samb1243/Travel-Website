import { describe, expect, it } from "vitest";
import { distanceKm, routeLengthKm, routePoints } from "./route-map";

const stop = (id: string, lat: number | null, lng: number | null) => ({ id, name: id, lat, lng });

describe("routePoints", () => {
  it("keeps route order and numbers every stop, located or not", () => {
    const { points, unlocated } = routePoints([
      stop("bangkok", 13.75, 100.5),
      stop("somewhere", null, null),
      stop("chiang-mai", 18.79, 98.98),
    ]);
    expect(points.map((p) => [p.id, p.number])).toEqual([
      ["bangkok", 1],
      ["chiang-mai", 3],
    ]);
    expect(unlocated.map((s) => [s.id, s.number])).toEqual([["somewhere", 2]]);
  });

  it("treats out-of-range or half-missing coordinates as no location", () => {
    const { points, unlocated } = routePoints([stop("a", 95, 10), stop("b", 10, null), stop("c", 10, 200)]);
    expect(points).toEqual([]);
    expect(unlocated).toHaveLength(3);
  });

  it("takes the short way across the 180° meridian", () => {
    const { points } = routePoints([stop("tokyo", 35.68, 139.69), stop("honolulu", 21.31, -157.86), stop("fiji", -18.1, 178.4)]);
    expect(points.map((p) => p.lng)).toEqual([139.69, 360 - 157.86, 178.4]);
  });

  it("leaves ordinary routes alone", () => {
    const { points } = routePoints([stop("lisbon", 38.72, -9.14), stop("berlin", 52.52, 13.4)]);
    expect(points.map((p) => p.lng)).toEqual([-9.14, 13.4]);
  });
});

describe("distances", () => {
  it("measures great-circle distance", () => {
    // London → Paris is about 344 km
    expect(Math.round(distanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 }))).toBeGreaterThan(340);
    expect(Math.round(distanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 }))).toBeLessThan(348);
  });

  it("works the same on unwrapped longitudes", () => {
    const wrapped = distanceKm({ lat: 35.68, lng: 139.69 }, { lat: 21.31, lng: -157.86 });
    const unwrapped = distanceKm({ lat: 35.68, lng: 139.69 }, { lat: 21.31, lng: 202.14 });
    expect(Math.abs(wrapped - unwrapped)).toBeLessThan(0.001);
  });

  it("sums the legs of a route", () => {
    expect(routeLengthKm([])).toBe(0);
    expect(routeLengthKm([{ lat: 0, lng: 0 }])).toBe(0);
    const a = { lat: 0, lng: 0 }, b = { lat: 0, lng: 1 }, c = { lat: 1, lng: 1 };
    expect(routeLengthKm([a, b, c])).toBeCloseTo(distanceKm(a, b) + distanceKm(b, c), 6);
  });
});
