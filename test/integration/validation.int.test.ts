// Inputs a malicious client could send straight to the server actions,
// bypassing the forms: every one must be rejected and store nothing.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addStop, reorderStops, saveItem, setItemStatus } from "@/server/actions/builder";
import { copyTrip, setVisibility } from "@/server/actions/sharing";
import { updateProfile } from "@/server/actions/profile";
import { MAX_STOPS_PER_TRIP } from "@/lib/limits";
import type { ItemFormInput } from "@/lib/validation/item";
import type { CurrentUser } from "@/server/session";
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
  status: "TO_BOOK",
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

  it("rejects more than 10 links", async () => {
    const links = Array.from({ length: 11 }, () => ({ kind: "INFO" as const, label: "", url: "https://example.com" }));
    expect((await saveItem(mine.trip.id, null, item({ links }))).ok).toBe(false);
  });
});

describe("enums, sizes and types", () => {
  it("rejects unknown statuses and visibilities", async () => {
    expect(await setItemStatus(mine.item.id, "PAID_BY_SOMEONE_ELSE" as never)).toMatchObject({ ok: false });
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
