// Reminder emails: only the trip's planners who haven't switched them off get
// them, each reminder goes out once however often the job runs, the job is
// locked on the live site, and the "stop emails" link only works for its own
// account.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/server/session";
import { runReminders } from "@/server/reminders";
import { setEmailReminders, unsubscribeFromEmail } from "@/server/actions/reminders";
import { unsubscribeToken, unsubscribeUrls } from "@/server/unsubscribe";
import { GET as cronRoute } from "@/app/api/cron/reminders/route";
import { POST as oneClickRoute } from "@/app/api/unsubscribe/route";
import { RedirectError } from "./errors";
import { db, makeTrip, makeUser, signInAs } from "./helpers";

const sent = vi.hoisted(() => [] as { to: string; subject: string; text: string; headers?: Record<string, string> }[]);
vi.mock("@/server/email", () => ({
  emailConfigured: () => false,
  sendEmail: async (email: (typeof sent)[number]) => {
    sent.push(email);
  },
}));

// Dates far from other test files' trips, so only this file's trips are due.
const NOW = new Date("2031-03-10T07:00:00Z");
const day = (d: string) => new Date(`${d}T00:00:00Z`);

let owner: CurrentUser;
let friend: CurrentUser;
let stranger: CurrentUser;
let f: Awaited<ReturnType<typeof makeTrip>>;

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET ??= "test-secret-for-reminder-links-0123456789";
});

beforeEach(async () => {
  sent.length = 0;
  owner = await makeUser("Maya");
  friend = await makeUser("Ben");
  stranger = await makeUser("Stranger");
  f = await makeTrip(owner.id, "PRIVATE", "Lisbon long weekend");
  await db.tripMember.create({ data: { tripId: f.trip.id, userId: friend.id } });
  // Starts tomorrow; a ferry still to book in 3 days, a hotel booked already, an adapter to buy undated (stop arrival)
  await db.trip.update({ where: { id: f.trip.id }, data: { startDate: day("2031-03-11"), endDate: day("2031-03-15") } });
  await db.stop.update({ where: { id: f.stop.id }, data: { arriveOn: day("2031-03-11") } });
  await db.item.createMany({
    data: [
      { tripId: f.trip.id, stopId: f.stop.id, category: "TRANSPORT", title: "Ferry to Cacilhas", status: "TO_BOOK", startAt: new Date("2031-03-13T09:30:00Z") },
      { tripId: f.trip.id, stopId: f.stop.id, category: "ACCOMMODATION", title: "Hotel booked already", status: "BOOKED", startAt: new Date("2031-03-12T15:00:00Z") },
      { tripId: f.trip.id, stopId: f.stop.id, category: "GEAR", title: "Plug adapter", status: "TO_BUY" },
    ],
  });
});

// Earlier tests' trips are still in the database: only look at this test's people
const mine = () => sent.filter((e) => [owner.email, friend.email, stranger.email].includes(e.to));

describe("the daily run", () => {
  it("emails the trip's planners about things still to book, and the day before it starts", async () => {
    await runReminders(NOW);
    const emails = mine();
    expect(emails.map((e) => e.to).sort()).toEqual([owner.email, owner.email, friend.email, friend.email].sort());
    expect(emails.some((e) => e.to === stranger.email)).toBe(false);

    const bookSoon = emails.find((e) => e.to === owner.email && e.subject.includes("soon"))!;
    expect(bookSoon.subject).toBe("2 things to book or buy soon: Lisbon long weekend");
    expect(bookSoon.text).toContain("Ferry to Cacilhas: in 3 days");
    expect(bookSoon.text).toContain("Plug adapter: tomorrow");
    expect(bookSoon.text).not.toContain("Hotel booked already");

    const eve = emails.find((e) => e.to === owner.email && !e.subject.includes("soon"))!;
    expect(eve.subject).toContain("tomorrow");

    // Every email can be unsubscribed from: a page link and mail apps' one-click button
    for (const e of emails) {
      const person = e.to === owner.email ? owner : friend;
      expect(e.text).toContain(unsubscribeUrls(person.id).page);
      expect(e.headers).toEqual({ "List-Unsubscribe": `<${unsubscribeUrls(person.id).oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
    }
  });

  it("never sends the same reminder twice", async () => {
    await runReminders(NOW);
    const first = mine().length;
    await runReminders(NOW);
    await runReminders(new Date("2031-03-10T19:00:00Z"));
    expect(mine()).toHaveLength(first);
    expect(await db.reminderLog.count({ where: { userId: owner.id } })).toBe(3); // ferry, adapter, trip-eve
  });

  it("skips people who switched reminders off", async () => {
    signInAs(friend);
    await setEmailReminders(false);
    await runReminders(NOW);
    expect(mine().every((e) => e.to === owner.email)).toBe(true);
    expect(mine().length).toBe(2);
  });

  it("leaves trips that aren't coming up alone", async () => {
    await runReminders(new Date("2031-01-01T07:00:00Z"));
    expect(mine()).toEqual([]);
  });
});

describe("switching reminders off", () => {
  it("from Profile, for yourself only, logged in", async () => {
    signInAs(null);
    await expect(setEmailReminders(false)).rejects.toBeInstanceOf(RedirectError);
    signInAs(owner);
    await setEmailReminders(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).emailReminders).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: friend.id } })).emailReminders).toBe(true);
    await setEmailReminders(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).emailReminders).toBe(true);
  });

  it("from the email link, only with a token made for that account", async () => {
    signInAs(null);
    expect(await unsubscribeFromEmail(friend.id, unsubscribeToken(owner.id))).toEqual({ ok: false });
    expect(await unsubscribeFromEmail(friend.id, "")).toEqual({ ok: false });
    expect(await unsubscribeFromEmail(friend.id, "x".repeat(43))).toEqual({ ok: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: friend.id } })).emailReminders).toBe(true);

    expect(await unsubscribeFromEmail(friend.id, unsubscribeToken(friend.id))).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: friend.id } })).emailReminders).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).emailReminders).toBe(true);
  });

  it("with mail apps' one-click button", async () => {
    const post = (url: string) => oneClickRoute(Object.assign(new Request(url, { method: "POST" }), { nextUrl: new URL(url) }) as never);
    const bad = await post(`http://localhost:3000/api/unsubscribe?u=${friend.id}&t=${unsubscribeToken(owner.id)}`);
    expect(bad.status).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: friend.id } })).emailReminders).toBe(true);

    const good = await post(unsubscribeUrls(friend.id).oneClick);
    expect(good.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: friend.id } })).emailReminders).toBe(false);
  });
});

describe("the reminder job's address", () => {
  it("refuses calls without the secret", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret-for-tests");
    try {
      expect((await cronRoute(new Request("http://localhost/api/cron/reminders"))).status).toBe(401);
      const wrong = new Request("http://localhost/api/cron/reminders", { headers: { authorization: "Bearer nope" } });
      expect((await cronRoute(wrong)).status).toBe(401);
      expect(sent).toEqual([]);
      const right = new Request("http://localhost/api/cron/reminders", { headers: { authorization: "Bearer cron-secret-for-tests" } });
      expect((await cronRoute(right)).status).toBe(200);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses everyone on the live site when no secret is set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect((await cronRoute(new Request("http://localhost/api/cron/reminders"))).status).toBe(503);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
