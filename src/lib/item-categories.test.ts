import { describe, expect, it } from "vitest";
import { countByGroup, inGroups, itemGroup } from "./item-categories";

describe("itemGroup", () => {
  it("puts every category in one of the four colour groups", () => {
    expect(itemGroup("FLIGHT")).toBe("TRAVEL");
    expect(itemGroup("TRANSPORT")).toBe("TRAVEL");
    expect(itemGroup("ACCOMMODATION")).toBe("STAY");
    expect(itemGroup("ACTIVITY")).toBe("DO");
    expect(itemGroup("FOOD")).toBe("DO");
    expect(itemGroup("GEAR")).toBe("KIT");
    expect(itemGroup("OTHER")).toBe("KIT");
  });
});

describe("inGroups", () => {
  it("shows everything when no group is picked", () => {
    expect(inGroups("FLIGHT", [])).toBe(true);
  });

  it("shows only items in the picked groups", () => {
    expect(inGroups("FLIGHT", ["TRAVEL"])).toBe(true);
    expect(inGroups("ACCOMMODATION", ["TRAVEL"])).toBe(false);
    expect(inGroups("FOOD", ["STAY", "DO"])).toBe(true);
  });
});

describe("countByGroup", () => {
  it("counts items per group", () => {
    expect(countByGroup([{ category: "FLIGHT" }, { category: "TRANSPORT" }, { category: "FOOD" }])).toEqual({
      TRAVEL: 2,
      STAY: 0,
      DO: 1,
      KIT: 0,
    });
  });
});
