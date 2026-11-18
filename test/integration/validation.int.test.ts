// Inputs a malicious client could send straight to the server actions,
// bypassing the forms: every one must be rejected and store nothing.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addStop, reorderStops, saveItem, setItemPayment, setItemStatus } from "@/server/actions/builder";
import { copyTrip, setVisibility } from "@/server/actions/sharing";
import { updateProfile } from "@/server/actions/profile";
import { MAX_STOPS_PER_TRIP } from "@/lib/limits";
import type { ItemFormInput } from "@/lib/validation/item";
import type { CurrentUser } from "@/server/session";
import { saveColors } from "@/server/actions/profile";
import { db, makeTrip, makeUser, signInAs, tripSnapshot } from "./helpers";

let me: CurrentUser;
let mine: Awaited<ReturnType<typeof makeTrip>>;

beforeAll(async () => {
  me = await makeUser("Tester");
});

beforeEach(async () => {
  signInAs(me);
  mine = await makeTrip(me.id, "PRIVATE", "Validation trip");
});

const item = (overrides: Partial<ItemFormInput>): ItemFormInput => ({
  stopId: null,
  category: "OTHER",
  title: "Thing",
  provider: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  fromPlace: "",
  toPlace: "",
  cost: "",
  status: "TO_BUY",
  confirmationCode: "",
  notes: "",
  privateNotes: "",
  links: [],
  ...overrides,
});

describe("item links", () => {
  for (const url of [
    "javascript:alert(document.cookie)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.example.com",
    "not a url",
  ]) {
    it(`rejects ${url.slice(0, 30)}`, async () => {
      const before = await tripSnapshot(mine.trip.id);
      const result = await saveItem(mine.trip.id, null, item({ links: [{ kind: "BOOKING", label: "", url }] }));
      expect(result.ok).toBe(false);
      expect(await tripSnapshot(mine.trip.id)).toEqual(before);
    });
  }

  it("only accepts statuses that fit the kind of item", async () => {
    expect(await saveItem(mine.trip.id, null, item({ status: "BOOKED" }))).toMatchObject({ ok: false, errors: { status: expect.any(String) } });
    expect(await saveItem(mine.trip.id, null, item({ category: "ACTIVITY", status: "TO_BUY" }))).toMatchObject({ ok: false });
    // Bookings need a booking status; gear and other may have none
    expect(await saveItem(mine.trip.id, null, item({ category: "ACTIVITY", status: "" }))).toMatchObject({ ok: false });
    expect(await saveItem(mine.trip.id, null, item({ status: "" }))).toMatchObject({ ok: true });
  });

  it("drops a payment status on gear and other, which are bought instead", async () => {
    const r = (await saveItem(mine.trip.id, null, item({ status: "BOUGHT", payment: "TO_PAY" }))) as { ok: true; id: string };
    expect(r.ok).toBe(true);
    expect(await db.item.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "BOUGHT", payment: null });
  });

  it("accepts photo links and uploads, and nothing else", async () => {
    for (const bad of ["javascript:alert(1)", "http://example.com/a.jpg", "/img/../etc/passwd", "data:image/png;base64,AAAA"]) {
      expect(await saveItem(mine.trip.id, null, item({ imageUrl: bad }))).toMatchObject({ ok: false, errors: { imageUrl: expect.any(String) } });
    }
    expect(await saveItem(mine.trip.id, null, item({ imageUrl: "https://example.com/view.jpg" }))).toMatchObject({ ok: true });
    expect(await saveItem(mine.trip.id, null, item({ imageUrl: "/img/cmabc1234567890abcdefghij" }))).toMatchObject({ ok: true });
  });

  it("limits the address length", async () => {
    expect(await saveItem(mine.trip.id, null, item({ address: "x".repeat(301) }))).toMatchObject({ ok: false, errors: { address: expect.any(String) } });
  });

  it("rejects more than 10 links", async () => {
    const links = Array.from({ length: 11 }, () => ({ kind: "INFO" as const, label: "", url: "https://example.com" }));
    expect((await saveItem(mine.trip.id, null, item({ links }))).ok).toBe(false);
  });
});

describe("enums, sizes and types", () => {
  it("rejects unknown statuses and visibilities", async () => {
    expect(await setItemStatus(mine.item.id, "PAID_BY_SOMEONE_ELSE" as never)).toMatchObject({ ok: false });
    // A guesthouse can't be "bought", and it can't skip having a booking status
    expect(await setItemStatus(mine.item.id, "BOUGHT")).toMatchObject({ ok: false });
    expect(await setItemPayment(mine.item.id, "LATER" as never)).toMatchObject({ ok: false });
    expect(await setVisibility(mine.trip.id, "EVERYONE")).toMatchObject({ ok: false });
    const trip = await db.trip.findUniqueOrThrow({ where: { id: mine.trip.id } });
    expect(trip.visibility).toBe("PRIVATE");
  });

  it("rejects oversized text", async () => {
    expect((await saveItem(mine.trip.id, null, item({ title: "x".repeat(151) }))).ok).toBe(false);
    expect((await saveItem(mine.trip.id, null, item({ notes: "x".repeat(2001) }))).ok).toBe(false);
  });

  it("rejects bad money and dates", async () => {
    for (const cost of ["-5", "1e309", "abc", "99999999999999"]) {
      expect((await saveItem(mine.trip.id, null, item({ cost }))).ok, cost).toBe(false);
    }
    expect((await saveItem(mine.trip.id, null, item({ startDate: "2027-02-30" }))).ok).toBe(false);
    expect((await copyTrip(mine.trip.id, { startDate: "tomorrow" })).ok).toBe(false);
  });

  it("rejects non-string ids instead of passing them to the database", async () => {
    for (const bad of [{ not: "a string" }, ["array"], "", "x".repeat(41)]) {
      await expect(setItemStatus(bad as never, "BOOKED")).rejects.toThrow();
    }
    await expect(reorderStops(mine.trip.id, "not-an-array" as never)).rejects.toThrow();
  });

  it("rejects bad coordinates and place ids on stops", async () => {
    const base = { name: "X", region: "", country: "", countryCode: "", placeId: "", lat: null, lng: null, arriveOn: "", departOn: "", notes: "" };
    expect((await addStop(mine.trip.id, { ...base, lat: 91, lng: 0 })).ok).toBe(false);
    expect((await addStop(mine.trip.id, { ...base, lat: 10, lng: null })).ok).toBe(false);
    expect((await addStop(mine.trip.id, { ...base, placeId: "osm:relation:1; DROP TABLE" })).ok).toBe(false);
  });

  it("caps the number of stops on a trip", async () => {
    await db.stop.createMany({
      data: Array.from({ length: MAX_STOPS_PER_TRIP - 1 }, (_, i) => ({ tripId: mine.trip.id, position: i + 1, name: `Stop ${i}` })),
    });
    const base = { name: "One too many", region: "", country: "", countryCode: "", placeId: "", lat: null, lng: null, arriveOn: "", departOn: "", notes: "" };
    expect(await addStop(mine.trip.id, base)).toMatchObject({ ok: false });
    expect(await db.stop.count({ where: { tripId: mine.trip.id } })).toBe(MAX_STOPS_PER_TRIP);
  });
});

describe("profile", () => {
  it("rejects a non-https avatar and an unknown currency", async () => {
    const fd = new FormData();
    fd.set("name", "Tester");
    fd.set("image", "javascript:alert(1)");
    fd.set("homeCurrency", "EUR");
    expect(await updateProfile({ ok: false }, fd)).toMatchObject({ ok: false });
    fd.set("image", "");
    fd.set("homeCurrency", "BTC");
    expect(await updateProfile({ ok: false }, fd)).toMatchObject({ ok: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: me.id } })).homeCurrency).toBe("EUR");
  });
});

describe("colour coding", () => {
  it("saves only known colours in #rrggbb form, and can reset them", async () => {
    await saveColors({ booked: "#123456", paid: "url(javascript:alert(1))", stay: "#b0308c", nonsense: "#000000" });
    // stay is the default colour, so there's nothing to save for it
    expect((await db.user.findUniqueOrThrow({ where: { id: me.id } })).colors).toEqual({ booked: "#123456" });
    await saveColors(null);
    expect((await db.user.findUniqueOrThrow({ where: { id: me.id } })).colors).toBeNull();
  });
});
