// Calendar export: the private feed link and the one-off download.

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as feedRoute } from "@/app/cal/[file]/route";
import { GET as downloadRoute } from "@/app/trips/[id]/calendar.ics/route";
import { getCalendarLink, resetCalendarLink, turnOffCalendarLink } from "@/server/actions/calendar";
import type { CurrentUser } from "@/server/session";
import { db, expectNotFound, makeTrip, makeUser, SECRET_CODE, SECRET_NOTE, signInAs } from "./helpers";

async function fetchFeed(token: string) {
  const res = await feedRoute(new NextRequest(`http://localhost/cal/${token}.ics`), {
    params: Promise.resolve({ file: `${token}.ics` }),
  });
  return { status: res.status, body: await res.text(), type: res.headers.get("content-type") };
}

async function download(tripId: string) {
  const res = await downloadRoute(new NextRequest(`http://localhost/trips/${tripId}/calendar.ics`), {
    params: Promise.resolve({ id: tripId }),
  });
  return { status: res.status, body: await res.text() };
}

let owner: CurrentUser;
let stranger: CurrentUser;
let f: Awaited<ReturnType<typeof makeTrip>>;

beforeEach(async () => {
  owner = await makeUser("Calendar Owner");
  stranger = await makeUser("Calendar Stranger");
  f = await makeTrip(owner.id, "PRIVATE", "Calendar trip");
  await db.item.update({ where: { id: f.item.id }, data: { startAt: new Date("2027-05-01T15:00:00Z") } });
});

describe("private calendar link", () => {
  it("serves the trip with confirmation numbers but never private notes", async () => {
    signInAs(owner);
    const { token } = await getCalendarLink(f.trip.id);
    const feed = await fetchFeed(token!);
    expect(feed.status).toBe(200);
    expect(feed.type).toContain("text/calendar");
    expect(feed.body).toContain("BEGIN:VCALENDAR");
    expect(feed.body).toContain("DTSTART:20270501T150000");
    expect(feed.body).toContain(SECRET_CODE);
    expect(feed.body).not.toContain("paid with card");
    expect(feed.body.replace(/\r\n /g, "")).not.toContain(SECRET_NOTE);
  });

  it("gives the same link until it's reset, then the old one stops working", async () => {
    signInAs(owner);
    const first = (await getCalendarLink(f.trip.id)).token!;
    expect((await getCalendarLink(f.trip.id)).token).toBe(first);
    const second = (await resetCalendarLink(f.trip.id)).token!;
    expect(second).not.toBe(first);
    expect((await fetchFeed(first)).status).toBe(404);
    expect((await fetchFeed(second)).status).toBe(200);
  });

  it("stops working when turned off", async () => {
    signInAs(owner);
    const { token } = await getCalendarLink(f.trip.id);
    await turnOffCalendarLink(f.trip.id);
    expect((await fetchFeed(token!)).status).toBe(404);
  });

  it("stops working when its owner is removed from the trip", async () => {
    const member = await makeUser("Calendar Member");
    await db.tripMember.create({ data: { tripId: f.trip.id, userId: member.id } });
    signInAs(member);
    const { token } = await getCalendarLink(f.trip.id);
    expect((await fetchFeed(token!)).status).toBe(200);
    await db.tripMember.delete({ where: { tripId_userId: { tripId: f.trip.id, userId: member.id } } });
    expect((await fetchFeed(token!)).status).toBe(404);
  });

  it("can't be made for someone else's trip, and made-up links don't work", async () => {
    signInAs(stranger);
    await expectNotFound(getCalendarLink(f.trip.id));
    expect(await db.calendarFeed.count({ where: { userId: stranger.id } })).toBe(0);
    for (const fake of ["x".repeat(32), "../../etc/passwd", "short"]) {
      expect((await fetchFeed(fake)).status).toBe(404);
    }
  });
});

describe("calendar download", () => {
  it("works for the owner", async () => {
    signInAs(owner);
    const res = await download(f.trip.id);
    expect(res.status).toBe(200);
    expect(res.body).toContain("X-WR-CALNAME:Calendar trip");
  });

  it("is a 404 for strangers and signed-out visitors", async () => {
    signInAs(stranger);
    expect((await download(f.trip.id)).status).toBe(404);
    signInAs(null);
    expect((await download(f.trip.id)).status).toBe(404);
  });
});
