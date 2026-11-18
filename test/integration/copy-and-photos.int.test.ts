// Copying a trip: the new traveller is reminded to add their own confirmation
// (the original's never leaves its owner), and transport times are cleared.
// Photo uploads: only real images, re-encoded without camera metadata.

import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getImage } from "@/app/img/[id]/route";
import { POST as upload } from "@/app/api/uploads/route";
import { saveItem } from "@/server/actions/builder";
import { setProfilePhoto, updateProfile } from "@/server/actions/profile";
import { copyTrip } from "@/server/actions/sharing";
import { getTripBuilderData } from "@/server/trips";
import type { CurrentUser } from "@/server/session";
import { saveUpload, UploadError } from "@/server/uploads";
import { RedirectError } from "./errors";
import { db, makeTrip, makeUser, SECRET_CODE, signInAs } from "./helpers";

let owner: CurrentUser;
let traveller: CurrentUser;

beforeEach(async () => {
  owner = await makeUser("Maya");
  traveller = await makeUser("Lukas");
});

/** Copies as `user`; the action sends you to the new trip, so its id comes from the redirect. */
async function copyAs(user: CurrentUser, tripId: string, startDate = "") {
  signInAs(user);
  const err = await copyTrip(tripId, { startDate }).then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(RedirectError);
  return (err as RedirectError).url.match(/^\/trips\/([^?]+)/)![1];
}

describe("copying a trip", () => {
  it("asks for your own confirmation where the original had one, until you add it", async () => {
    const f = await makeTrip(owner.id, "PUBLIC"); // its guesthouse has a confirmation number and link
    const copyId = await copyAs(traveller, f.trip.id);

    const copied = await db.item.findFirstOrThrow({ where: { tripId: copyId } });
    expect(copied).toMatchObject({ needsOwnConfirmation: true, confirmationCode: null, status: "TO_BOOK", payment: null });
    expect(JSON.stringify(await getTripBuilderData(copyId, traveller.id))).not.toContain(SECRET_CODE);
    let data = await getTripBuilderData(copyId, traveller.id);
    expect(data!.stops[0].items[0].needsOwnConfirmation).toBe(true);

    // Once they add their own, the reminder goes away
    await db.item.update({ where: { id: copied.id }, data: { confirmationCode: "MINE-123" } });
    data = await getTripBuilderData(copyId, traveller.id);
    expect(data!.stops[0].items[0].needsOwnConfirmation).toBe(false);
  });

  it("keeps the day of a bus but clears its time", async () => {
    const f = await makeTrip(owner.id, "PUBLIC");
    signInAs(owner);
    await saveItem(f.trip.id, null, {
      stopId: f.stop.id,
      category: "TRANSPORT",
      title: "",
      provider: "Rede Expressos",
      startDate: "2027-05-03",
      startTime: "08:15",
      endDate: "2027-05-03",
      endTime: "11:30",
      fromPlace: "Lisbon",
      toPlace: "Porto",
      address: "Sete Rios bus station",
      cost: "20",
      status: "BOOKED",
      payment: "PAID",
      confirmationCode: "",
      notes: "",
      privateNotes: "",
      links: [],
    });

    const copyId = await copyAs(traveller, f.trip.id, "2027-06-01"); // the trip starts 1 May: +31 days
    const bus = await db.item.findFirstOrThrow({ where: { tripId: copyId, category: "TRANSPORT" } });
    expect(bus).toMatchObject({
      startAt: new Date("2027-06-03T00:00:00Z"),
      endAt: new Date("2027-06-03T00:00:00Z"),
      allDay: true,
      address: "Sete Rios bus station",
      status: "TO_BOOK",
      payment: "TO_PAY",
    });
  });
});

const png = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 120, b: 90 } } })
    .png()
    .withExif({ IFD0: { Make: "SecretCam", Copyright: "GPS 38.72,-9.14" } })
    .toBuffer();

describe("photo uploads", () => {
  it("re-encodes photos as WebP, shrinks big ones, and drops camera metadata", async () => {
    const { url } = await saveUpload(owner.id, new Blob([new Uint8Array(await png(3000, 2000))]));
    expect(url).toMatch(/^\/img\/[a-z0-9]+$/);

    const res = await getImage(new Request(`http://localhost${url}`), { params: Promise.resolve({ id: url.slice(5) }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const bytes = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1600, 1067]);
    expect(meta.exif).toBeUndefined();
    expect(bytes.toString("latin1")).not.toContain("SecretCam");
  });

  it("stores profile photos smaller", async () => {
    const { url } = await saveUpload(owner.id, new Blob([new Uint8Array(await png(2000, 1000))]), "avatar");
    const row = await db.upload.findUniqueOrThrow({ where: { id: url.slice(5) } });
    expect([row.width, row.height]).toEqual([512, 256]);
  });

  it("lets you use your own upload as your profile photo, but not someone else's", async () => {
    const mine = await saveUpload(owner.id, new Blob([new Uint8Array(await png(100, 100))]), "avatar");
    const theirs = await saveUpload(traveller.id, new Blob([new Uint8Array(await png(100, 100))]), "avatar");
    const profile = (image: string) => {
      const fd = new FormData();
      fd.set("name", "Maya");
      fd.set("image", image);
      fd.set("homeCurrency", "EUR");
      return updateProfile({ ok: false }, fd);
    };
    signInAs(owner);
    expect(await profile(theirs.url)).toMatchObject({ ok: false, errors: { image: expect.any(String) } });
    expect(await profile("/img/doesnotexist000000000000")).toMatchObject({ ok: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).image).toBeNull();

    expect(await profile(mine.url)).toMatchObject({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).image).toBe(mine.url);
  });

  it("saves a new profile photo straight away, and only your own", async () => {
    const mine = await saveUpload(owner.id, new Blob([new Uint8Array(await png(100, 100))]), "avatar");
    const theirs = await saveUpload(traveller.id, new Blob([new Uint8Array(await png(100, 100))]), "avatar");
    signInAs(owner);
    const image = async () => (await db.user.findUniqueOrThrow({ where: { id: owner.id } })).image;

    expect(await setProfilePhoto(theirs.url)).toMatchObject({ ok: false });
    expect(await setProfilePhoto("javascript:alert(1)")).toMatchObject({ ok: false });
    expect(await image()).toBeNull();

    expect(await setProfilePhoto(mine.url)).toMatchObject({ ok: true });
    expect(await image()).toBe(mine.url);
    expect(await setProfilePhoto("")).toMatchObject({ ok: true });
    expect(await image()).toBeNull();
  });

  it("rejects files that aren't images", async () => {
    await expect(saveUpload(owner.id, new Blob(["<svg onload=alert(1)>"]))).rejects.toBeInstanceOf(UploadError);
    await expect(saveUpload(owner.id, new Blob([]))).rejects.toBeInstanceOf(UploadError);
  });

  it("needs you to be logged in", async () => {
    signInAs(null);
    const body = new FormData();
    body.set("file", new Blob([new Uint8Array(await png(10, 10))]));
    const res = await upload(new Request("http://localhost/api/uploads", { method: "POST", body }));
    expect(res.status).toBe(401);
    expect(await db.upload.count({ where: { userId: owner.id } })).toBe(0);
  });

  it("returns 404 for unknown or malformed ids", async () => {
    for (const id of ["doesnotexist0000000000000", "../../etc"]) {
      const res = await getImage(new Request("http://localhost/img/x"), { params: Promise.resolve({ id }) });
      expect(res.status).toBe(404);
    }
  });
});
