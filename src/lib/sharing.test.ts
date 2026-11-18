import { describe, expect, it } from "vitest";
import { parseDateOnly as d } from "@/lib/dates";
import { canViewTrip, firstDateOf, planTripCopy, stripPersonal, type CopySource } from "./sharing";

describe("canViewTrip", () => {
  it("lets the owner see everything and others only public or unlisted trips", () => {
    expect(canViewTrip({ visibility: "PRIVATE", ownerId: "me" }, "me")).toBe(true);
    expect(canViewTrip({ visibility: "PRIVATE", ownerId: "me" }, "you")).toBe(false);
    expect(canViewTrip({ visibility: "PRIVATE", ownerId: "me" }, null)).toBe(false);
    expect(canViewTrip({ visibility: "UNLISTED", ownerId: "me" }, null)).toBe(true);
    expect(canViewTrip({ visibility: "PUBLIC", ownerId: "me" }, "you")).toBe(true);
  });

  it("lets members of a private trip see it, and nobody else", () => {
    const trip = { visibility: "PRIVATE" as const, ownerId: "me", memberIds: ["friend"] };
    expect(canViewTrip(trip, "friend")).toBe(true);
    expect(canViewTrip(trip, "stranger")).toBe(false);
    expect(canViewTrip(trip, null)).toBe(false);
  });
});

describe("stripPersonal", () => {
  it("removes confirmation numbers, private notes and confirmation links", () => {
    const item = {
      title: "Hostel",
      notes: "Ask for a top bunk",
      confirmationCode: "HW-123",
      privateNotes: "Paid with card ending 1234",
      links: [
        { kind: "BOOKING" as const, url: "https://example.com/book" },
        { kind: "CONFIRMATION" as const, url: "https://example.com/my-booking?token=secret" },
      ],
    };
    const shared = stripPersonal(item);
    expect(shared.confirmationCode).toBeNull();
    expect(shared.privateNotes).toBeNull();
    expect(shared.notes).toBe("Ask for a top bunk");
    expect(shared.links.map((l) => l.kind)).toEqual(["BOOKING"]);
    expect(JSON.stringify(shared)).not.toMatch(/HW-123|1234|secret/);
  });
});

let n = 0;
const newId = () => `new${++n}`;

const source: CopySource = {
  id: "src",
  ownerId: "maya",
  ownerName: "Maya Chen",
  title: "Three weeks in Thailand",
  types: ["BACKPACKING", "MULTI_CITY"],
  description: "Hostels and night trains",
  coverImageUrl: "https://images.example.com/cover.jpg",
  startDate: d("2027-01-31"),
  endDate: d("2027-02-21"),
  currency: "USD",
  budget: 2600,
  travellers: 1,
  stops: [
    { id: "s2", position: 1, name: "Chiang Mai", region: null, country: "Thailand", countryCode: "TH", placeId: null, lat: 18.8, lng: 98.9, arriveOn: d("2027-02-05"), departOn: d("2027-02-08"), notes: null },
    { id: "s1", position: 0, name: "Bangkok", region: null, country: "Thailand", countryCode: "TH", placeId: "osm:relation:1", lat: 13.7, lng: 100.5, arriveOn: d("2027-02-01"), departOn: d("2027-02-04"), notes: "Stay near Khao San" },
  ],
  items: [
    {
      stopId: "s1",
      position: 0,
      category: "ACCOMMODATION",
      title: "Hostel",
      provider: "Hostelworld",
      startAt: new Date("2027-02-01T14:00:00Z"),
      endAt: new Date("2027-02-04T11:00:00Z"),
      allDay: false,
      fromPlace: null,
      toPlace: null,
      cost: 48,
      currency: null,
      status: "BOOKED",
      notes: "Top bunks are quieter",
      links: [
        { kind: "CONFIRMATION", label: "My booking", url: "https://example.com/mine", position: 0 },
        { kind: "BOOKING", label: null, url: "https://example.com/book", position: 1 },
      ],
    },
    {
      stopId: null,
      position: 0,
      category: "OTHER",
      title: "Travel insurance",
      provider: null,
      startAt: null,
      endAt: null,
      allDay: false,
      fromPlace: null,
      toPlace: null,
      cost: 95,
      currency: null,
      status: "PAY_ON_ARRIVAL",
      notes: null,
      links: [],
    },
  ],
};

describe("planTripCopy", () => {
  const copy = planTripCopy(source, { newOwnerId: "lukas", slug: "three-weeks-abc", newId });

  it("makes a private trip for the new owner that credits the original", () => {
    expect(copy.trip).toMatchObject({
      ownerId: "lukas",
      slug: "three-weeks-abc",
      title: "Three weeks in Thailand",
      visibility: "PRIVATE",
      publishedAt: null,
      copiedFromTripId: "src",
      copiedFromTitle: "Three weeks in Thailand",
      copiedFromAuthor: "Maya Chen",
      budget: 2600,
      currency: "USD",
      types: ["BACKPACKING", "MULTI_CITY"],
    });
  });

  it("resets every status to To book and strips personal details", () => {
    expect(copy.items.map((i) => i.status)).toEqual(["TO_BOOK", "TO_BOOK"]);
    expect(copy.items.every((i) => i.confirmationCode === null && i.privateNotes === null)).toBe(true);
    expect(copy.items.every((i) => i.createdById === "lukas")).toBe(true); // the person copying
    expect(copy.links.map((l) => [l.kind, l.url, l.position])).toEqual([["BOOKING", "https://example.com/book", 0]]);
  });

  it("keeps shared notes, costs and the route order, re-pointing items at the new stops", () => {
    expect(copy.stops.map((s) => [s.name, s.position])).toEqual([
      ["Bangkok", 0],
      ["Chiang Mai", 1],
    ]);
    const bangkok = copy.stops[0];
    expect(copy.items[0]).toMatchObject({ stopId: bangkok.id, tripId: copy.trip.id, notes: "Top bunks are quieter", cost: 48 });
    expect(copy.items[1].stopId).toBeNull();
    expect(copy.links[0].itemId).toBe(copy.items[0].id);
  });

  it("uses fresh ids everywhere", () => {
    const ids = [copy.trip.id, ...copy.stops.map((s) => s.id), ...copy.items.map((i) => i.id), ...copy.links.map((l) => l.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("s1");
    expect(ids).not.toContain("src");
  });

  it("shifts every date when a new start date is given", () => {
    const moved = planTripCopy(source, { newOwnerId: "lukas", slug: "x", newId, startDate: d("2027-03-01") });
    // 31 Jan → 1 Mar is +29 days
    expect(moved.trip.startDate).toEqual(d("2027-03-01"));
    expect(moved.trip.endDate).toEqual(d("2027-03-22"));
    expect(moved.stops[0].arriveOn).toEqual(d("2027-03-02"));
    expect(moved.items[0].startAt).toEqual(new Date("2027-03-02T14:00:00Z"));
    expect(moved.items[1].startAt).toBeNull();
  });

  it("labels a duplicate of your own trip instead of crediting yourself", () => {
    const dupe = planTripCopy(source, { newOwnerId: "maya", slug: "x", newId });
    expect(dupe.trip).toMatchObject({ title: "Three weeks in Thailand (copy)", copiedFromTripId: null, copiedFromAuthor: null });
  });
});

describe("firstDateOf", () => {
  it("falls back to the earliest stop or item date", () => {
    expect(firstDateOf({ ...source, startDate: null })).toEqual(d("2027-02-01"));
    expect(firstDateOf({ startDate: null, stops: [], items: [] })).toBeNull();
  });
});
