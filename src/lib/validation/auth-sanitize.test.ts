import { describe, expect, it } from "vitest";
import { sanitizeUserFields } from "./auth";

describe("sanitizeUserFields", () => {
  it("trims, collapses spaces and caps the name", () => {
    expect(sanitizeUserFields({ name: "  Maya   Chen " }).name).toBe("Maya Chen");
    expect(sanitizeUserFields({ name: "x".repeat(500) }).name).toHaveLength(80);
    expect(sanitizeUserFields({ name: "   " }).name).toBe("Traveller");
    expect(sanitizeUserFields({ name: 42 }).name).toBe("Traveller");
  });

  it("keeps photos uploaded here", () => {
    expect(sanitizeUserFields({ image: "/img/cmabc1234567890abcdefghij" }).image).toBe("/img/cmabc1234567890abcdefghij");
    expect(sanitizeUserFields({ image: "/img/../../etc/passwd" }).image).toBeNull();
    expect(sanitizeUserFields({ image: "//evil.example/a.png" }).image).toBeNull();
  });

  it("keeps only https avatar links", () => {
    expect(sanitizeUserFields({ image: "https://lh3.googleusercontent.com/a/abc" }).image).toBe("https://lh3.googleusercontent.com/a/abc");
    expect(sanitizeUserFields({ image: "http://example.com/a.png" }).image).toBeNull();
    expect(sanitizeUserFields({ image: "javascript:alert(1)" }).image).toBeNull();
    expect(sanitizeUserFields({ image: "data:image/svg+xml,<svg onload=alert(1)>" }).image).toBeNull();
    expect(sanitizeUserFields({ image: `https://x.com/${"a".repeat(2000)}` }).image).toBeNull();
  });

  it("leaves fields that weren't sent alone", () => {
    expect(sanitizeUserFields({ emailVerified: true })).toEqual({ emailVerified: true });
  });
});
