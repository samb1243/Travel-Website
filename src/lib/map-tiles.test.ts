import { describe, expect, it } from "vitest";
import { tileSource } from "./map-tiles";

describe("tileSource", () => {
  it("uses MapTiler with its credit when a key is set", () => {
    const t = tileSource("AbCdEf123456");
    expect(t.url).toBe("https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=AbCdEf123456");
    expect(t.attribution).toContain("MapTiler");
    expect(t.attribution).toContain("OpenStreetMap");
  });

  it("falls back to OpenStreetMap without a key, or with a malformed one", () => {
    expect(tileSource(undefined).url).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(tileSource("").url).toContain("tile.openstreetmap.org");
    expect(tileSource('x"><script>').url).toContain("tile.openstreetmap.org");
  });
});
