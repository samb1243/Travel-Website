import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps relative paths", () => {
    expect(safeNextPath("/trips/abc?tab=map")).toBe("/trips/abc?tab=map");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/foo\nbar",
    "",
    null,
    undefined,
  ])("falls back for %s", (value) => {
    expect(safeNextPath(value)).toBe("/dashboard");
  });
});
