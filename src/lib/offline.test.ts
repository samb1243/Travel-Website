import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_OFFLINE_TRIPS, OFFLINE_CACHE_VERSION, offlinePagesFor, savedTripsFrom, INDEX_URL } from "./offline";

describe("offlinePagesFor", () => {
  it("saves My trips and each trip's tabs, up to the limit", () => {
    const trips = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, title: `Trip ${i}` }));
    const pages = offlinePagesFor(trips);
    expect(pages[0]).toEqual({ path: "/dashboard", title: "My trips" });
    expect(pages.slice(1, 5).map((p) => p.path)).toEqual(["/trips/t0", "/trips/t0/itinerary", "/trips/t0/checklist", "/trips/t0/budget"]);
    expect(new Set(pages.slice(1).map((p) => p.title)).size).toBe(MAX_OFFLINE_TRIPS);
  });
});

describe("savedTripsFrom", () => {
  it("groups saved pages by trip, newest first", () => {
    const trips = savedTripsFrom({
      user: "u1",
      savedAt: 3,
      pages: {
        "/dashboard": { savedAt: 3, title: "My trips" },
        "/trips/a": { savedAt: 1, title: "Alps" },
        "/trips/a/itinerary": { savedAt: 2, title: null },
        "/trips/b/checklist": { savedAt: 5, title: null },
        "/t/someone-elses": { savedAt: 9, title: null },
      },
    });
    expect(trips).toEqual([
      { id: "b", title: "Trip", tabs: ["/checklist"], savedAt: 5 },
      { id: "a", title: "Alps", tabs: ["", "/itinerary"], savedAt: 2 },
    ]);
  });
});

describe("public/sw.js", () => {
  const sw = readFileSync("public/sw.js", "utf8");

  it("uses the same cache names and index address as the app", () => {
    expect(sw).toContain(`const VERSION = "${OFFLINE_CACHE_VERSION}";`);
    expect(sw).toContain("tripster-pages-${VERSION}");
    expect(sw).toContain("tripster-images-${VERSION}");
    expect(sw).toContain(`const INDEX_URL = "${INDEX_URL}";`);
  });

  it("only saves pages that belong to trips, My trips or shared trips", () => {
    // The patterns from the service worker, run here against example paths
    const block = /const SAVEABLE = \[([\s\S]*?)\];/.exec(sw)![1];
    const patterns = [...block.matchAll(/\/\^(.*?)\$\//g)].map((m) => new RegExp(`^${m[1]}$`));
    const saveable = (path: string) => patterns.some((re) => re.test(path));
    for (const ok of ["/dashboard", "/trips/abc123", "/trips/abc123/itinerary", "/trips/abc/budget", "/t/three-weeks-sea"]) {
      expect(saveable(ok)).toBe(true);
    }
    for (const no of ["/login", "/profile", "/trips/abc/edit", "/trips/abc/print", "/api/uploads", "/explore", "/cal/x.ics", "/trips/new", "/trips/new/../x"]) {
      expect(saveable(no)).toBe(false);
    }
  });
});
