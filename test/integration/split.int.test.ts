// Splitting costs: only people on the trip can be "paid by" or share a cost,
// only the trip's planners can settle up, and none of it leaves the group.

import { beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/server/session";
import type { ItemFormInput } from "@/lib/validation/item";
import { saveItem } from "@/server/actions/builder";
import { deleteSettlement, recordSettlement } from "@/server/actions/split";
import { copyTrip } from "@/server/actions/sharing";
import { getSharedTrip } from "@/server/shared-trips";
import { getTripSplit } from "@/server/split";
import { summariseSplit } from "@/lib/split";
import { RedirectError } from "./errors";
import { db, expectNotFound, makeTrip, makeUser, signInAs } from "./helpers";

let owner: CurrentUser;
let friend: CurrentUser;
let stranger: CurrentUser;
let f: Awaited<ReturnType<typeof makeTrip>>;

const dinner = (over: Partial<ItemFormInput> = {}): ItemFormInput => ({
  stopId: f.stop.id,
  category: "FOOD",
  title: "Dinner at Taberna",
  provider: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  fromPlace: "",
  toPlace: "",
  cost: "90",
  status: "NOT_NEEDED",
  confirmationCode: "",
  notes: "",
  privateNotes: "",
  links: [],
  ...over,
});

beforeEach(async () => {
  owner = await makeUser("Maya");
  friend = await makeUser("Ben");
  stranger = await makeUser("Stranger");
  f = await makeTrip(owner.id, "PUBLIC");
  await db.tripMember.create({ data: { tripId: f.trip.id, userId: friend.id } });
});

describe("who paid", () => {
  it("records who paid and who shares it, for people on the trip only", async () => {
    signInAs(owner);
    const r = (await saveItem(f.trip.id, null, dinner({ paidById: friend.id, splitWith: [owner.id, friend.id] }))) as { ok: boolean; id: string };
    expect(r.ok).toBe(true);
    expect(await db.item.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ paidById: friend.id, splitWith: [owner.id, friend.id] });

    expect(await saveItem(f.trip.id, null, dinner({ paidById: stranger.id }))).toMatchObject({ ok: false, errors: { paidById: expect.any(String) } });
    expect(await saveItem(f.trip.id, null, dinner({ splitWith: [stranger.id] }))).toMatchObject({ ok: false, errors: { splitWith: expect.any(String) } });
  });

  it("never shows on shared pages or comes along when the trip is copied", async () => {
    signInAs(owner);
    await saveItem(f.trip.id, null, dinner({ paidById: friend.id, splitWith: [friend.id] }));
    await recordSettlement(f.trip.id, { fromId: owner.id, toId: friend.id, amount: 20 });

    signInAs(null);
    const shared = await getSharedTrip(f.trip.slug, null);
    const items = shared!.stops.flatMap((s) => s.items);
    expect(items.every((i) => i.paidById === null && i.splitWith.length === 0)).toBe(true);
    expect(JSON.stringify(shared)).not.toContain(friend.id);

    signInAs(stranger);
    const err = await copyTrip(f.trip.id, { startDate: "" }).then(
      () => null,
      (e: unknown) => e,
    );
    const copyId = (err as RedirectError).url.match(/^\/trips\/([^?]+)/)![1];
    const copied = await db.item.findMany({ where: { tripId: copyId } });
    expect(copied.every((i) => i.paidById === null && i.splitWith.length === 0)).toBe(true);
    expect(await db.settlement.count({ where: { tripId: copyId } })).toBe(0);
  });
});

describe("settling up", () => {
  it("records and undoes payments between people on the trip, and the balances follow", async () => {
    signInAs(owner);
    await saveItem(f.trip.id, null, dinner({ paidById: owner.id })); // €90, split by 2

    let split = await getTripSplit(f.trip.id);
    const items = await db.item.findMany({ where: { tripId: f.trip.id } });
    const expenses = items.map((i) => ({ amount: Number(i.cost ?? 0), paidById: i.paidById, splitWith: i.splitWith }));
    expect(summariseSplit(split.people, expenses, split.payments).transfers).toEqual([{ fromId: friend.id, toId: owner.id, amount: 45 }]);

    signInAs(friend); // members can settle up too
    expect(await recordSettlement(f.trip.id, { fromId: friend.id, toId: owner.id, amount: 45 })).toEqual({ ok: true });
    split = await getTripSplit(f.trip.id);
    expect(summariseSplit(split.people, expenses, split.payments).transfers).toEqual([]);

    expect(await deleteSettlement(split.settlements[0].id)).toEqual({ ok: true });
    expect(await db.settlement.count({ where: { tripId: f.trip.id } })).toBe(0);
  });

  it("refuses payments that don't make sense", async () => {
    signInAs(owner);
    expect(await recordSettlement(f.trip.id, { fromId: owner.id, toId: owner.id, amount: 10 })).toMatchObject({ ok: false });
    expect(await recordSettlement(f.trip.id, { fromId: stranger.id, toId: owner.id, amount: 10 })).toMatchObject({ ok: false });
    expect(await recordSettlement(f.trip.id, { fromId: friend.id, toId: owner.id, amount: -5 })).toMatchObject({ ok: false });
    expect(await recordSettlement(f.trip.id, { fromId: friend.id, toId: owner.id, amount: "lots" as never })).toMatchObject({ ok: false });
    expect(await db.settlement.count({ where: { tripId: f.trip.id } })).toBe(0);
  });

  it("is only for the trip's planners", async () => {
    signInAs(owner);
    await recordSettlement(f.trip.id, { fromId: friend.id, toId: owner.id, amount: 10 });
    const [payment] = await db.settlement.findMany({ where: { tripId: f.trip.id } });

    signInAs(stranger);
    await expectNotFound(recordSettlement(f.trip.id, { fromId: friend.id, toId: owner.id, amount: 10 }));
    await expectNotFound(deleteSettlement(payment.id));
    await expectNotFound(deleteSettlement("does-not-exist"));
    expect(await db.settlement.count({ where: { tripId: f.trip.id } })).toBe(1);
  });
});
