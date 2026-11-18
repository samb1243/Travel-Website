// Planning together: invite links, what members can and can't do, and that
// leaving or being removed really takes access away.

import { beforeEach, describe, expect, it } from "vitest";
import { addStop, saveItem, setItemStatus } from "@/server/actions/builder";
import { acceptInvite, createInviteLink, leaveTrip, removeMember, turnOffInviteLink } from "@/server/actions/people";
import { setVisibility } from "@/server/actions/sharing";
import { deleteTrip, updateTrip } from "@/server/actions/trips";
import { MAX_TRIP_PEOPLE } from "@/lib/limits";
import { getSharedTrip } from "@/server/shared-trips";
import { getTripBuilderData, listMyTrips } from "@/server/trips";
import type { CurrentUser } from "@/server/session";
import type { StopInput } from "@/lib/validation/stop";
import { RedirectError } from "./errors";
import { db, expectNotFound, makeTrip, makeUser, signInAs, tripSnapshot, SECRET_CODE } from "./helpers";

const stop: StopInput = {
  name: "Sintra",
  region: "",
  country: "",
  countryCode: "",
  placeId: "",
  lat: null,
  lng: null,
  arriveOn: "",
  departOn: "",
  notes: "",
};

function tripForm(title: string) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({
    title,
    types: "OTHER",
    startDate: "",
    endDate: "",
    currency: "EUR",
    budget: "",
    travellers: "2",
    description: "",
    coverImageUrl: "",
  })) fd.set(k, v);
  return fd;
}

/** Runs an action that should redirect, and returns where to. */
async function redirectOf(p: Promise<unknown>) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(RedirectError);
  return (err as RedirectError).url;
}

let owner: CurrentUser;
let friend: CurrentUser;
let stranger: CurrentUser;
let f: Awaited<ReturnType<typeof makeTrip>>;

async function inviteToken() {
  signInAs(owner);
  const r = await createInviteLink(f.trip.id);
  expect(r.ok).toBe(true);
  return r.token!;
}

async function join(user: CurrentUser, token: string) {
  signInAs(user);
  return acceptInvite(token).then(
    (result) => ({ result, url: null as string | null }),
    (e: unknown) => {
      if (e instanceof RedirectError) return { result: null, url: e.url };
      throw e;
    },
  );
}

beforeEach(async () => {
  owner = await makeUser("Organiser");
  friend = await makeUser("Friend");
  stranger = await makeUser("Stranger");
  f = await makeTrip(owner.id, "PRIVATE", "Group trip");
});

describe("joining with an invite link", () => {
  it("adds the person as a member and takes them to the trip", async () => {
    const token = await inviteToken();
    const { url } = await join(friend, token);
    expect(url).toBe(`/trips/${f.trip.id}?joined=1`);
    expect(await db.tripMember.count({ where: { tripId: f.trip.id, userId: friend.id } })).toBe(1);
  });

  it("doesn't add anyone twice, or add the owner as a member", async () => {
    const token = await inviteToken();
    await join(friend, token);
    await join(friend, token);
    await join(owner, token);
    expect(await db.tripMember.count({ where: { tripId: f.trip.id } })).toBe(1);
  });

  it("refuses links that are turned off, replaced, expired or made up", async () => {
    const first = await inviteToken();
    const second = await inviteToken(); // making a new link turns the first one off
    expect((await join(friend, first)).result).toMatchObject({ ok: false });

    signInAs(owner);
    await turnOffInviteLink(f.trip.id);
    expect((await join(friend, second)).result).toMatchObject({ ok: false });

    const third = await inviteToken();
    await db.tripInvite.update({ where: { token: third }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await join(friend, third)).result).toMatchObject({ ok: false });

    for (const fake of ["x".repeat(32), "../../etc", "", "a'; DROP TABLE"]) {
      expect((await join(friend, fake)).result).toMatchObject({ ok: false });
    }
    expect(await db.tripMember.count({ where: { tripId: f.trip.id } })).toBe(0);
  });

  it("sends signed-out visitors to log in first", async () => {
    const token = await inviteToken();
    signInAs(null);
    expect(await redirectOf(acceptInvite(token))).toMatch(/^\/login\?next=%2Finvite%2F/);
  });

  it(`stops at ${MAX_TRIP_PEOPLE} people`, async () => {
    const token = await inviteToken();
    const others = await Promise.all(Array.from({ length: MAX_TRIP_PEOPLE - 1 }, (_, i) => makeUser(`Member${i}`)));
    await db.tripMember.createMany({ data: others.map((u) => ({ tripId: f.trip.id, userId: u.id })) });
    expect((await join(friend, token)).result).toMatchObject({ ok: false });
  });
});

describe("what members can do", () => {
  beforeEach(async () => {
    await join(friend, await inviteToken());
    signInAs(friend);
  });

  it("can edit stops, bookings, statuses and trip details", async () => {
    expect(await addStop(f.trip.id, stop)).toMatchObject({ ok: true });
    expect(await setItemStatus(f.item.id, "TO_BOOK")).toMatchObject({ ok: true });
    expect(
      await saveItem(f.trip.id, null, {
        stopId: f.stop.id,
        category: "FOOD",
        title: "Pastéis de nata",
        provider: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        fromPlace: "",
        toPlace: "",
        cost: "",
        status: "NOT_NEEDED",
        confirmationCode: "",
        notes: "",
        privateNotes: "",
        links: [],
      }),
    ).toMatchObject({ ok: true });
    expect(await redirectOf(updateTrip(f.trip.id, {}, tripForm("Group trip, renamed")))).toBe(`/trips/${f.trip.id}`);
    expect((await db.trip.findUniqueOrThrow({ where: { id: f.trip.id } })).title).toBe("Group trip, renamed");
  });

  it("sees the trip on My trips, marked as shared, with the group's private details", async () => {
    const mine = await listMyTrips(friend.id);
    expect(mine.find((t) => t.id === f.trip.id)).toMatchObject({ sharedBy: "Organiser" });
    const data = await getTripBuilderData(f.trip.id, friend.id);
    expect(data?.stops[0].items[0].confirmationCode).toBe(SECRET_CODE);
  });

  it("can preview the private trip's shared page", async () => {
    const shared = await getSharedTrip(f.trip.slug, friend.id);
    expect(shared).toMatchObject({ isOwner: false, canEdit: true });
    expect(await getSharedTrip(f.trip.slug, stranger.id)).toBeNull();
  });

  it("can't delete the trip, change who sees it, or manage people", async () => {
    const before = await tripSnapshot(f.trip.id);
    await expectNotFound(deleteTrip(f.trip.id));
    await expectNotFound(setVisibility(f.trip.id, "PUBLIC"));
    await expectNotFound(createInviteLink(f.trip.id));
    await expectNotFound(turnOffInviteLink(f.trip.id));
    await expectNotFound(removeMember(f.trip.id, friend.id));
    expect(await tripSnapshot(f.trip.id)).toEqual(before);
    expect(await db.tripMember.count({ where: { tripId: f.trip.id } })).toBe(1);
  });
});

describe("Added by", () => {
  const food = (title: string, stopId: string) => ({
    stopId,
    category: "FOOD" as const,
    title,
    provider: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    fromPlace: "",
    toPlace: "",
    cost: "",
    status: "NOT_NEEDED" as const,
    confirmationCode: "",
    notes: "",
    privateNotes: "",
    links: [],
  });

  it("records who added each booking and shows it to the group", async () => {
    await join(friend, await inviteToken());
    signInAs(friend);
    const { id: friendsItem } = (await saveItem(f.trip.id, null, food("Friend's pick", f.stop.id))) as { id: string };
    signInAs(owner);
    const { id: ownersItem } = (await saveItem(f.trip.id, null, food("Owner's pick", f.stop.id))) as { id: string };

    expect((await db.item.findUniqueOrThrow({ where: { id: friendsItem } })).createdById).toBe(friend.id);

    const asOwner = (await getTripBuilderData(f.trip.id, owner.id))!.stops[0].items;
    expect(asOwner.find((i) => i.id === friendsItem)?.addedBy).toEqual({ name: "Friend", isYou: false });
    expect(asOwner.find((i) => i.id === ownersItem)?.addedBy).toEqual({ name: "Organiser", isYou: true });

    const asFriend = (await getTripBuilderData(f.trip.id, friend.id))!.stops[0].items;
    expect(asFriend.find((i) => i.id === friendsItem)?.addedBy).toEqual({ name: "Friend", isYou: true });
  });

  it("isn't shown on a trip only one person is planning", async () => {
    signInAs(owner);
    await saveItem(f.trip.id, null, food("Solo pick", f.stop.id));
    const items = (await getTripBuilderData(f.trip.id, owner.id))!.stops[0].items;
    expect(items.every((i) => i.addedBy === null)).toBe(true);
  });

  it("never puts group members' names on the public page", async () => {
    await join(friend, await inviteToken());
    signInAs(friend);
    await saveItem(f.trip.id, null, food("Late-night ramen", f.stop.id)); // title must not contain the name
    await db.trip.update({ where: { id: f.trip.id }, data: { visibility: "PUBLIC" } });
    const shared = await getSharedTrip(f.trip.slug, null);
    expect(JSON.stringify(shared)).not.toContain("Friend");
    expect(shared!.stops[0].items.every((i) => i.addedBy === null)).toBe(true);
  });
});

describe("losing access", () => {
  beforeEach(async () => {
    await join(friend, await inviteToken());
  });

  it("when the owner removes them", async () => {
    signInAs(owner);
    expect(await removeMember(f.trip.id, friend.id)).toMatchObject({ ok: true });
    signInAs(friend);
    await expectNotFound(addStop(f.trip.id, stop));
    expect(await getTripBuilderData(f.trip.id, friend.id)).toBeNull();
    expect((await listMyTrips(friend.id)).map((t) => t.id)).not.toContain(f.trip.id);
  });

  it("when they leave", async () => {
    signInAs(friend);
    expect(await redirectOf(leaveTrip(f.trip.id))).toBe("/dashboard?left=1");
    await expectNotFound(addStop(f.trip.id, stop));
    expect(await leaveTrip(f.trip.id)).toMatchObject({ ok: false });
  });

  it("strangers never had any", async () => {
    signInAs(stranger);
    await expectNotFound(addStop(f.trip.id, stop));
    expect(await leaveTrip(f.trip.id)).toMatchObject({ ok: false });
    expect((await listMyTrips(stranger.id)).map((t) => t.id)).not.toContain(f.trip.id);
  });
});
