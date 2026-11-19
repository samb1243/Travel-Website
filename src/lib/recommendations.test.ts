import { describe, expect, it } from "vitest";
import { buildIdeas, cleanTitle, ideaKey, type IdeaSource } from "./recommendations";

const src = (ownerId: string, title: string, over: Partial<IdeaSource> = {}): IdeaSource => ({
  ownerId,
  category: "ACTIVITY",
  title,
  provider: null,
  address: null,
  price: null,
  ...over,
});

describe("ideaKey", () => {
  it("treats small differences in the name as the same idea", () => {
    const k = ideaKey("ACTIVITY", "Grand Palace & Wat Pho");
    expect(ideaKey("ACTIVITY", "Grand palace and Wat Pho (morning)")).toBe(k);
    expect(ideaKey("ACTIVITY", "Grand Palace, Wat Pho")).not.toBe(k);
    expect(ideaKey("FOOD", "Grand Palace & Wat Pho")).not.toBe(k);
    expect(ideaKey("ACCOMMODATION", "Café Tèrra")).toBe(ideaKey("ACCOMMODATION", "cafe terra"));
  });

  it("cleanTitle drops notes in brackets", () => {
    expect(cleanTitle("Riverside bungalow (3 nights)")).toBe("Riverside bungalow");
  });
});

describe("buildIdeas", () => {
  it("only shows ideas at least three different travellers have", () => {
    const ideas = buildIdeas(
      [
        src("a", "Thai cooking class"),
        src("b", "Thai Cooking Class (morning)"),
        src("c", "Thai cooking class"),
        src("a", "Elephant Nature Park"),
        src("b", "Elephant Nature Park"),
      ],
      [],
    );
    expect(ideas.map((i) => [i.title, i.travellers])).toEqual([["Thai cooking class", 3]]);
  });

  it("counts one vote per traveller, however many of their trips have it", () => {
    const sources = [src("a", "Doi Suthep"), src("a", "Doi Suthep"), src("a", "Doi Suthep"), src("b", "Doi Suthep")];
    expect(buildIdeas(sources, [])).toEqual([]);
  });

  it("shows the typical price (median, one per traveller) and the usual provider and address", () => {
    const [idea] = buildIdeas(
      [
        src("a", "Green Tiger House", { category: "ACCOMMODATION", price: 30, address: "10 Sinharat Rd", provider: "Booking.com" }),
        src("b", "Green Tiger House", { category: "ACCOMMODATION", price: 40, address: "10 Sinharat Rd", provider: "Booking.com" }),
        src("c", "Green Tiger House", { category: "ACCOMMODATION", price: 60, address: null, provider: "Hostelworld" }),
        src("c", "Green Tiger House", { category: "ACCOMMODATION", price: 1000, address: null }), // c's second trip doesn't skew it
      ],
      [],
    );
    expect(idea).toMatchObject({ travellers: 3, typicalPrice: 40, priceBasis: "night", address: "10 Sinharat Rd", provider: "Booking.com" });
  });

  it("gives no price when fewer than two travellers priced it", () => {
    const [idea] = buildIdeas([src("a", "X", { price: 12 }), src("b", "X"), src("c", "X")], []);
    expect(idea.typicalPrice).toBeNull();
  });

  it("marks ideas already in your plans, and puts the most popular first", () => {
    const ideas = buildIdeas(
      [
        ...["a", "b", "c"].map((o) => src(o, "Pai Canyon")),
        ...["a", "b", "c", "d"].map((o) => src(o, "Night market", { category: "FOOD" })),
      ],
      [{ category: "ACTIVITY", title: "Pai canyon (sunset)" }],
    );
    expect(ideas.map((i) => [i.title, i.travellers, i.alreadyPlanned])).toEqual([
      ["Night market", 4, false],
      ["Pai Canyon", 3, true],
    ]);
  });
});
