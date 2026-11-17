import { describe, expect, it } from "vitest";
import { makeTripSlug, randomSuffix, slugify } from "./slug";

describe("slugify", () => {
  it("handles accents, ampersands and punctuation", () => {
    expect(slugify("Thailand, Laos & Vietnam!")).toBe("thailand-laos-and-vietnam");
    expect(slugify("Schönbrunn – Côte d'Azur")).toBe("schonbrunn-cote-d-azur");
  });
});

describe("makeTripSlug", () => {
  it("adds an unguessable suffix", () => {
    const slug = makeTripSlug("Tour du Mont Blanc");
    expect(slug).toMatch(/^tour-du-mont-blanc-[a-z2-9]{10}$/);
  });

  it("falls back when the title has no usable characters", () => {
    expect(makeTripSlug("🏔️🏔️", "abc")).toBe("trip-abc");
  });

  it("rarely repeats suffixes", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => randomSuffix()));
    expect(seen.size).toBe(1000);
  });
});
