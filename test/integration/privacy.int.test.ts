// "Never expose private trips", and never expose personal details
// (confirmation numbers, private notes, confirmation links) to anyone but the owner.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { copyTrip, setSaved, setVisibility } from "@/server/actions/sharing";
import { parseExploreFilters } from "@/lib/explore";
import { getCopySource, getSharedTrip, listExploreCountries, listPublicTrips, listSavedTrips } from "@/server/shared-trips";
import type { CurrentUser } from "@/server/session";
import { RedirectError } from "./errors";
import { db, expectNoSecrets, makeTrip, makeUser, SECRET_CODE, signInAs } from "./helpers";

let owner: CurrentUser;
let viewer: CurrentUser;
let priv: Awaited<ReturnType<typeof makeTrip>>;
let unlisted: Awaited<ReturnType<typeof makeTrip>>;
let pub: Awaited<ReturnType<typeof makeTrip>>;

beforeAll(async () => {
  owner = await makeUser("Sharer");
  viewer = await makeUser("Viewer");
  priv = await makeTrip(owner.id, "PRIVATE", "Secret honeymoon");
  unlisted = await makeTrip(owner.id, "UNLISTED", "Friends only");
  pub = await makeTrip(owner.id, "PUBLIC", "Open road");
});

describe("shared trip page data (/t/<slug>)", () => {
  it("returns nothing for a private trip, signed out or signed in as someone else", async () => {
    expect(await getSharedTrip(priv.trip.slug, null)).toBeNull();
    expect(await getSharedTrip(priv.trip.slug, viewer.id)).toBeNull();
  });

  it("lets the owner preview their private trip", async () => {
    const data = await getSharedTrip(priv.trip.slug, owner.id);
    expect(data?.isOwner).toBe(true);
  });

  it("shows unlisted and public trips to anyone, without personal details", async () => {
    for (const f of [unlisted, pub]) {
      for (const who of [null, viewer.id, owner.id]) {
        const data = await getSharedTrip(f.trip.slug, who);
        expect(data).not.toBeNull();
        expectNoSecrets(data);
        const item = data!.stops[0].items[0];
        expect(item.confirmationCode).toBeNull();
        expect(item.privateNotes).toBeNull();
        expect(item.links.map((l) => l.kind)).toEqual(["BOOKING"]);
        expect(item.notes).toBe("Shared note: ask for the terrace room"); // shared notes do show
      }
    }
  });

  it("never sends the owner's id or email to the page", async () => {
    const json = JSON.stringify(await getSharedTrip(pub.trip.slug, null));
    expect(json).not.toContain(owner.email);
    expect(json).not.toContain(owner.id);
    expect(json).toContain(owner.name);
  });

  it("rejects malformed slugs without querying", async () => {
    for (const slug of ["", "../etc/passwd", "a".repeat(500), "UPPER", "x' OR '1'='1"]) {
      expect(await getSharedTrip(slug, null)).toBeNull();
    }
  });

  it("stops showing a trip the moment it's made private", async () => {
    const f = await makeTrip(owner.id, "PUBLIC", "Changing my mind");
    expect(await getSharedTrip(f.trip.slug, viewer.id)).not.toBeNull();
    signInAs(owner);
    await setVisibility(f.trip.id, "PRIVATE");
    expect(await getSharedTrip(f.trip.slug, viewer.id)).toBeNull();
    expect(await getCopySource(f.trip.id, viewer.id)).toBeNull();
  });
});

describe("Explore", () => {
  it("only ever lists public trips (not private, not unlisted)", async () => {
    const { trips } = await listPublicTrips(parseExploreFilters({}));
    const ids = trips.map((t) => t.id);
    expect(ids).toContain(pub.trip.id);
    expect(ids).not.toContain(priv.trip.id);
    expect(ids).not.toContain(unlisted.trip.id);
    expectNoSecrets(trips);
  });

  it("keeps private trips out even when every filter matches them", async () => {
    const { trips } = await listPublicTrips(parseExploreFilters({ country: "PT", type: "OTHER", length: "week" }));
    expect(trips.map((t) => t.id)).not.toContain(priv.trip.id);
  });

  it("only offers countries from public trips", async () => {
    await makeTrip(owner.id, "PRIVATE", "Hidden");
    await db.trip.updateMany({ where: { title: "Hidden" }, data: { countryCodes: ["KP"] } });
    expect(await listExploreCountries()).not.toContain("KP");
  });
});

describe("saved trips", () => {
  beforeEach(() => signInAs(viewer));

  it("drop out of the list when the owner makes them private", async () => {
    const f = await makeTrip(owner.id, "PUBLIC", "Saved then hidden");
    expect(await setSaved(f.trip.id, true)).toMatchObject({ ok: true });
    expect((await listSavedTrips(viewer.id)).map((t) => t.id)).toContain(f.trip.id);

    await db.trip.update({ where: { id: f.trip.id }, data: { visibility: "PRIVATE" } });
    expect((await listSavedTrips(viewer.id)).map((t) => t.id)).not.toContain(f.trip.id);
  });
});

describe("Copy this trip", () => {
  beforeEach(() => signInAs(viewer));

  async function copy(tripId: string, startDate = "") {
    const err = await copyTrip(tripId, { startDate }).then(
      () => null,
      (e: unknown) => e,
    );
    // Success ends with a redirect to the new trip
    expect(err).toBeInstanceOf(RedirectError);
    const newId = (err as RedirectError).url.match(/^\/trips\/([^?]+)\?copied=1$/)![1];
    return db.trip.findUniqueOrThrow({
      where: { id: newId },
      include: { stops: true, items: { include: { links: true } } },
    });
  }

  it("creates a private copy for the viewer with personal details removed and statuses reset", async () => {
    const copied = await copy(pub.trip.id, "2027-06-10");
    expect(copied.ownerId).toBe(viewer.id);
    expect(copied.visibility).toBe("PRIVATE");
    expect(copied.copiedFromTripId).toBe(pub.trip.id);
    expect(copied.copiedFromAuthor).toBe("Sharer");
    expect(copied.startDate?.toISOString().slice(0, 10)).toBe("2027-06-10");
    expect(copied.items.every((i) => i.status === "TO_BOOK")).toBe(true);
    expect(copied.items.every((i) => i.confirmationCode === null && i.privateNotes === null)).toBe(true);
    expect(copied.items.flatMap((i) => i.links.map((l) => l.kind))).toEqual(["BOOKING"]);
    expect(copied.stops[0].id).not.toBe(pub.stop.id);
    expect(copied.items[0].stopId).toBe(copied.stops[0].id);
    expectNoSecrets(copied);
  });

  it("works for unlisted trips too (anyone with the link)", async () => {
    const copied = await copy(unlisted.trip.id);
    expect(copied.ownerId).toBe(viewer.id);
  });

  it("leaves the original untouched", async () => {
    await copy(pub.trip.id);
    const original = await db.item.findUniqueOrThrow({ where: { id: pub.item.id } });
    expect(original.status).toBe("BOOKED");
    expect(original.confirmationCode).toBe(SECRET_CODE);
  });
});
