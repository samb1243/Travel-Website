import { describe, expect, it } from "vitest";
import { changedColors, cleanCustomColors, CUSTOM_COLORS_CSS, customColorsCss, DEFAULT_COLORS, textOn } from "./colors";

describe("cleanCustomColors", () => {
  it("keeps known keys with #rrggbb colours only", () => {
    expect(
      cleanCustomColors({
        booked: "#00FF00",
        "to-book": "red",
        stay: "#123",
        evil: "#000000",
        travel: "#000000;}body{display:none",
      }),
    ).toEqual({ booked: "#00ff00" });
    expect(cleanCustomColors("nope")).toEqual({});
    expect(cleanCustomColors(null)).toEqual({});
    expect(cleanCustomColors(["#000000"])).toEqual({});
  });
});

describe("changedColors", () => {
  it("drops colours that are the same as the defaults", () => {
    expect(changedColors({ booked: DEFAULT_COLORS.booked, paid: "#000000" })).toEqual({ paid: "#000000" });
  });
});

describe("textOn", () => {
  it("picks white on dark colours and dark text on light ones", () => {
    expect(textOn("#1c3a32")).toBe("#ffffff");
    expect(textOn("#f4c430")).toBe("#14231f");
    expect(textOn("#ffffff")).toBe("#14231f");
  });
});

describe("customColorsCss", () => {
  it("sets the colour, a readable text colour and the ink for both themes", () => {
    const css = customColorsCss({ booked: "#ffff00" });
    expect(css).toBe(":root:root,:root.dark{--k-booked:#ffff00;--k-booked-fg:#14231f;--k-booked-ink:#ffff00;}");
    expect(CUSTOM_COLORS_CSS.test(css)).toBe(true);
  });

  it("is empty without custom colours", () => {
    expect(customColorsCss({})).toBe("");
    expect(CUSTOM_COLORS_CSS.test("")).toBe(true);
  });

  it("the browser-copy check rejects anything else", () => {
    expect(CUSTOM_COLORS_CSS.test("body{display:none}")).toBe(false);
    expect(CUSTOM_COLORS_CSS.test(":root:root,:root.dark{--k-booked:#ffff00;}</style><script>")).toBe(false);
  });
});
