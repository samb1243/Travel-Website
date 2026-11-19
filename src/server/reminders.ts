import "server-only";
import { db } from "@/lib/db";
import { addDays, toDateOnly } from "@/lib/dates";
import { bookSoonEmail, dueBookingReminders, REMIND_AT_DAYS, tripEveEmail, tripEveKey } from "@/lib/reminders";
import { sendEmail } from "@/server/email";
import { siteUrl, unsubscribeUrls } from "@/server/unsubscribe";

// The daily reminder run (src/app/api/cron/reminders/route.ts, once a day on
// Vercel). Emails the people planning each trip, if they haven't switched
// reminders off: things still to book coming up, and "starts tomorrow".
// Each reminder is claimed in ReminderLog before it's sent, so overlapping
// runs can't send it twice.

const LOOKAHEAD_DAYS = Math.max(...REMIND_AT_DAYS) + 1;

export type ReminderRun = { trips: number; emails: number };

export async function runReminders(now = new Date()): Promise<ReminderRun> {
  const today = toDateOnly(now);
  const from = new Date(`${today}T00:00:00.000Z`);
  const until = addDays(from, LOOKAHEAD_DAYS);
  const open = { in: ["TO_BOOK" as const, "TO_BUY" as const] };

  // Trips with something in the reminder window: starting soon, or an open item or stop coming up
  const trips = await db.trip.findMany({
    where: {
      OR: [
        { startDate: { gte: from, lte: until } },
        { items: { some: { status: open, startAt: { gte: from, lte: until } } } },
        { stops: { some: { arriveOn: { gte: from, lte: until }, items: { some: { status: open, startAt: null } } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      owner: { select: { id: true, name: true, email: true, emailReminders: true } },
      members: { select: { user: { select: { id: true, name: true, email: true, emailReminders: true } } } },
      stops: { orderBy: { position: "asc" }, select: { id: true, name: true, arriveOn: true } },
      items: { where: { status: open }, select: { id: true, title: true, status: true, startAt: true, stopId: true } },
    },
  });

  let emails = 0;
  for (const trip of trips) {
    const people = [trip.owner, ...trip.members.map((m) => m.user)].filter((p) => p.emailReminders);
    if (!people.length) continue;
    const stops = trip.stops.map((s) => ({ id: s.id, name: s.name, arriveOn: s.arriveOn ? toDateOnly(s.arriveOn) : null }));
    const items = trip.items.map((i) => ({ ...i, startAt: i.startAt?.toISOString() ?? null }));
    const tripUrl = `${siteUrl()}/trips/${trip.id}`;
    const eveKey = tripEveKey(trip.id, trip.startDate ? toDateOnly(trip.startDate) : null, today);

    const keys = items.flatMap((i) => REMIND_AT_DAYS.map((t) => `book-soon:${i.id}:${t}`));
    if (eveKey) keys.push(eveKey);
    const logs = await db.reminderLog.findMany({
      where: { userId: { in: people.map((p) => p.id) }, key: { in: keys } },
      select: { userId: true, key: true },
    });

    for (const person of people) {
      const sent = new Set(logs.filter((l) => l.userId === person.id).map((l) => l.key));
      const unsubscribe = unsubscribeUrls(person.id);
      const headers = { "List-Unsubscribe": `<${unsubscribe.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };

      const due = dueBookingReminders(items, stops, today, sent);
      if (due.length && (await claim(person.id, due.map((d) => d.key), now))) {
        const mail = bookSoonEmail({ name: person.name, tripTitle: trip.title, tripUrl, unsubscribeUrl: unsubscribe.page, due });
        await sendEmail({ to: person.email, ...mail, headers });
        emails++;
      }

      if (eveKey && !sent.has(eveKey) && (await claim(person.id, [eveKey], now))) {
        const mail = tripEveEmail({
          name: person.name,
          tripTitle: trip.title,
          tripUrl,
          unsubscribeUrl: unsubscribe.page,
          firstStop: stops[0]?.name ?? null,
          stillToBook: items.length,
        });
        await sendEmail({ to: person.email, ...mail, headers });
        emails++;
      }
    }
  }

  // Old log rows are only needed while their dates are near
  await db.reminderLog.deleteMany({ where: { sentAt: { lt: addDays(from, -400) } } });
  return { trips: trips.length, emails };
}

/** Records the keys as sent; false if another run already claimed them all. */
async function claim(userId: string, keys: string[], sentAt: Date): Promise<boolean> {
  const { count } = await db.reminderLog.createMany({ data: keys.map((key) => ({ userId, key, sentAt })), skipDuplicates: true });
  return count > 0;
}
