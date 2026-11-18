// "Users can only edit their own trips": every action that changes a trip,
// called by someone who doesn't own it, and by someone who isn't signed in.
// Each refused call must leave the database exactly as it was.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addStop,
  deleteItem,
  deleteStop,
  reorderStops,
  saveItem,
  setItemPayment,
  setItemStatus,
  updateStop,
} from "@/server/actions/builder";
import { copyTrip, setSaved, setVisibility } from "@/server/actions/sharing";
import { createTrip, deleteTrip, updateTrip } from "@/server/actions/trips";
import { updateProfile } from "@/server/actions/profile";
import { loadEditorTrip } from "@/server/trip-page";
import { getTripBuilderData, getTripForEditor } from "@/server/trips";
import type { CurrentUser } from "@/server/session";
import type { ItemFormInput } from "@/lib/validation/item";
import type { StopInput } from "@/lib/validation/stop";
import {
  db,
  expectLoginRedirect,
  expectNotFound,
  makeTrip,
  makeUser,
  signInAs,
  tripSnapshot,
} from "./helpers";

const stopInput: StopInput = {
  name: "Porto",
  region: "",
  country: "Portugal",
  countryCode: "PT",
  placeId: "",
  lat: 41.15,
  lng: -8.61,
  arriveOn: "2027-05-03",
  departOn: "2027-05-05",
  notes: "",
};

const itemInput = (stopId: string | null): ItemFormInput => ({
  stopId,
  category: "ACTIVITY",
  title: "Port wine tasting",
  provider: "",
  startDate: "2027-05-04",
  startTime: "17:00",
  endDate: "",
  endTime: "",
  fromPlace: "",
  toPlace: "",
  cost: "25",
  status: "TO_BOOK",
  confirmationCode: "",
  notes: "",
  privateNotes: "",
  links: [],
});

function tripForm(title: string) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({
    title,
    types: "OTHER",
    startDate: "",
    endDate: "",
    currency: "EUR",
    budget: "",
    travellers: "1",
    description: "",
    coverImageUrl: "",
  })) fd.set(k, v);
  return fd;
}

let owner: CurrentUser;
let stranger: CurrentUser;
let fixture: Awaited<ReturnType<typeof makeTrip>>;
let publicFixture: Awaited<ReturnType<typeof makeTrip>>;

beforeAll(async () => {
  owner = await makeUser("Owner");
  stranger = await makeUser("Stranger");
});

beforeEach(async () => {
  fixture = await makeTrip(owner.id, "PRIVATE", "Owner private");
  publicFixture = await makeTrip(owner.id, "PUBLIC", "Owner public");
});

describe("someone else's trip, signed in as a different user", () => {
  beforeEach(() => signInAs(stranger));

  // Every write action, against both a private and a public trip: public
  // means "anyone can view and copy", never "anyone can edit".
  const attempts: [string, (f: typeof fixture) => Promise<unknown>][] = [
    ["addStop", (f) => addStop(f.trip.id, stopInput)],
    ["updateStop", (f) => updateStop(f.stop.id, stopInput)],
    ["deleteStop", (f) => deleteStop(f.stop.id, false)],
    ["reorderStops", (f) => reorderStops(f.trip.id, [f.stop.id])],
    ["saveItem (new item)", (f) => saveItem(f.trip.id, null, itemInput(null))],
    ["saveItem (edit item)", (f) => saveItem(f.trip.id, f.item.id, itemInput(null))],
    ["setItemStatus", (f) => setItemStatus(f.item.id, "TO_BOOK")],
    ["setItemPayment", (f) => setItemPayment(f.item.id, "PAID")],
    ["deleteItem", (f) => deleteItem(f.item.id)],
    ["updateTrip", (f) => updateTrip(f.trip.id, {}, tripForm("Hijacked"))],
    ["deleteTrip", (f) => deleteTrip(f.trip.id)],
    ["setVisibility", (f) => setVisibility(f.trip.id, "PUBLIC")],
  ];

  for (const [name, attempt] of attempts) {
    for (const which of ["private", "public"] as const) {
      it(`${name} on a ${which} trip is refused as "not found" and changes nothing`, async () => {
        const f = which === "private" ? fixture : publicFixture;
        const before = await tripSnapshot(f.trip.id);
        await expectNotFound(attempt(f));
        expect(await tripSnapshot(f.trip.id)).toEqual(before);
      });
    }
  }

  it("can't attach its own item to someone else's stop", async () => {
    const mine = await makeTrip(stranger.id, "PRIVATE", "Stranger trip");
    const result = await saveItem(mine.trip.id, null, itemInput(fixture.stop.id));
    expect(result).toEqual({ ok: false, errors: { stopId: "Pick a stop on this trip" } });
    expect(await db.item.count({ where: { stopId: fixture.stop.id } })).toBe(1);
  });

  it("can't edit someone else's item by passing its own trip id", async () => {
    const mine = await makeTrip(stranger.id, "PRIVATE", "Stranger trip");
    await expectNotFound(saveItem(mine.trip.id, fixture.item.id, itemInput(null)));
    expect((await db.item.findUnique({ where: { id: fixture.item.id } }))?.title).toBe("Guesthouse in Alfama");
  });

  it("can't smuggle someone else's stop into its own reorder", async () => {
    const mine = await makeTrip(stranger.id, "PRIVATE", "Stranger trip");
    const result = await reorderStops(mine.trip.id, [fixture.stop.id, mine.stop.id]);
    expect(result.ok).toBe(false);
    expect((await db.stop.findUnique({ where: { id: fixture.stop.id } }))?.position).toBe(0);
  });

  it("can't open the trip's editor pages or load its data", async () => {
    await expectNotFound(loadEditorTrip(Promise.resolve({ id: fixture.trip.id })));
    await expectNotFound(loadEditorTrip(Promise.resolve({ id: publicFixture.trip.id })));
    expect(await getTripForEditor(fixture.trip.id, stranger.id)).toBeNull();
    expect(await getTripBuilderData(fixture.trip.id, stranger.id)).toBeNull();
  });

  it("gets the same answer for a trip that doesn't exist (no probing)", async () => {
    await expectNotFound(loadEditorTrip(Promise.resolve({ id: "does-not-exist" })));
    await expectNotFound(setItemStatus("does-not-exist", "BOOKED"));
  });

  it("can't save or copy a private trip", async () => {
    expect(await setSaved(fixture.trip.id, true)).toMatchObject({ ok: false });
    expect(await copyTrip(fixture.trip.id, { startDate: "" })).toMatchObject({ ok: false });
    expect(await db.savedTrip.count({ where: { userId: stranger.id } })).toBe(0);
    expect(await db.trip.count({ where: { ownerId: stranger.id, copiedFromTripId: fixture.trip.id } })).toBe(0);
  });
});

describe("the owner", () => {
  beforeEach(() => signInAs(owner));

  it("can do everything on their own trip", async () => {
    expect(await addStop(fixture.trip.id, stopInput)).toMatchObject({ ok: true });
    expect(await saveItem(fixture.trip.id, null, itemInput(fixture.stop.id))).toMatchObject({ ok: true });
    expect(await setItemStatus(fixture.item.id, "NOT_NEEDED")).toMatchObject({ ok: true });
    expect(await setItemPayment(fixture.item.id, "PAY_ON_ARRIVAL")).toMatchObject({ ok: true });
    expect(await setVisibility(fixture.trip.id, "UNLISTED")).toMatchObject({ ok: true });
    expect((await db.trip.findUnique({ where: { id: fixture.trip.id } }))?.visibility).toBe("UNLISTED");
  });

  it("can't save their own trip", async () => {
    expect(await setSaved(publicFixture.trip.id, true)).toMatchObject({ ok: false, message: "This is your own trip." });
  });
});

describe("signed out", () => {
  beforeEach(() => signInAs(null));

  const attempts: [string, () => Promise<unknown>][] = [
    ["addStop", () => addStop(fixture.trip.id, stopInput)],
    ["updateStop", () => updateStop(fixture.stop.id, stopInput)],
    ["deleteStop", () => deleteStop(fixture.stop.id, true)],
    ["reorderStops", () => reorderStops(fixture.trip.id, [fixture.stop.id])],
    ["saveItem", () => saveItem(fixture.trip.id, null, itemInput(null))],
    ["setItemStatus", () => setItemStatus(fixture.item.id, "TO_BOOK")],
    ["setItemPayment", () => setItemPayment(fixture.item.id, "PAID")],
    ["deleteItem", () => deleteItem(fixture.item.id)],
    ["createTrip", () => createTrip({}, tripForm("Anonymous"))],
    ["updateTrip", () => updateTrip(fixture.trip.id, {}, tripForm("Anonymous"))],
    ["deleteTrip", () => deleteTrip(fixture.trip.id)],
    ["setVisibility", () => setVisibility(fixture.trip.id, "PUBLIC")],
    ["setSaved", () => setSaved(publicFixture.trip.id, true)],
    ["copyTrip (even a public trip)", () => copyTrip(publicFixture.trip.id, { startDate: "" })],
    ["updateProfile", () => updateProfile({ ok: false }, new FormData())],
  ];

  for (const [name, attempt] of attempts) {
    it(`${name} goes to the login page and changes nothing`, async () => {
      const before = await tripSnapshot(fixture.trip.id);
      const trips = await db.trip.count();
      await expectLoginRedirect(attempt());
      expect(await tripSnapshot(fixture.trip.id)).toEqual(before);
      expect(await db.trip.count()).toBe(trips);
    });
  }
});
