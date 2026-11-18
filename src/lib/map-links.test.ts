import { describe, expect, it } from "vitest";
import { mapLinksFor } from "./map-links";

const base = { address: null, fromPlace: null, toPlace: null, title: "Lub d Hostel" };

describe("mapLinksFor", () => {
  it("searches for the place by name and address", () => {
    const [google, apple] = mapLinksFor({ ...base, address: "4 Decho Rd, Bangkok" });
    expect(google.href).toBe("https://www.google.com/maps/search/?api=1&query=Lub%20d%20Hostel%2C%204%20Decho%20Rd%2C%20Bangkok");
    expect(apple.href).toBe("https://maps.apple.com/?q=Lub%20d%20Hostel%2C%204%20Decho%20Rd%2C%20Bangkok");
  });

  it("doesn't repeat the name when the address already has it", () => {
    const [google] = mapLinksFor({ ...base, address: "Lub d Hostel, 4 Decho Rd" });
    expect(google.href).toContain("query=Lub%20d%20Hostel%2C%204%20Decho%20Rd");
    expect(google.href).not.toContain("Hostel%2C%20Lub");
  });

  it("gives directions for transport between two places", () => {
    const [google, apple] = mapLinksFor({ ...base, title: "Bus", fromPlace: "Chiang Mai Arcade", toPlace: "Pai" });
    expect(google.href).toBe("https://www.google.com/maps/dir/?api=1&origin=Chiang%20Mai%20Arcade&destination=Pai");
    expect(apple.href).toBe("https://maps.apple.com/?saddr=Chiang%20Mai%20Arcade&daddr=Pai");
  });

  it("returns nothing without an address or a route", () => {
    expect(mapLinksFor(base)).toEqual([]);
  });
});
