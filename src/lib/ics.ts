// iCalendar (.ics, RFC 5545) for a trip, so it can go into Google/Apple/Outlook
// calendars. Pure, so it's unit-tested.
//
// Times: bookings are stored as local wall-clock times at the place they happen
// (a 07:40 departure in Bangkok is 07:40). They're written as "floating" times
// (no time zone), which calendar apps show exactly as written, wherever you are.
// That matches how the app itself shows them.

import { addDays, parseDateOnly, toDateOnly } from "@/lib/dates";
import type { ItemCategory, ItemStatus, LinkKind } from "@/generated/prisma/enums";

type CalendarLink = { kind: LinkKind; label: string | null; url: string };

export type CalendarItem = {
  id: string;
  category: ItemCategory;
  title: string;
  provider: string | null;
  /** Wall-clock ISO string, e.g. "2027-02-04T18:40:00.000Z" means 18:40 local */
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  fromPlace: string | null;
  toPlace: string | null;
  status: ItemStatus;
  confirmationCode: string | null;
  notes: string | null;
  links: CalendarLink[];
  stopName: string | null;
};

export type CalendarStop = { id: string; name: string; country: string | null; arriveOn: string | null; departOn: string | null };

export type CalendarInput = {
  tripId: string;
  title: string;
  description: string | null;
  stops: CalendarStop[];
  items: CalendarItem[];
  /** When the file was made (UTC), for DTSTAMP */
  generatedAt: Date;
  /** Link back to the trip in Tripster */
  tripUrl: string;
};

const EMOJI: Record<ItemCategory, string> = {
  FLIGHT: "✈️",
  ACCOMMODATION: "🛏️",
  TRANSPORT: "🚆",
  ACTIVITY: "🎟️",
  FOOD: "🍽️",
  GEAR: "🎒",
  OTHER: "📌",
};

const STATUS_TEXT: Record<ItemStatus, string> = {
  BOOKED: "Booked",
  PAY_ON_ARRIVAL: "Pay on arrival",
  TO_BOOK: "Still to book",
  NOT_NEEDED: "No booking needed",
};

/** Escapes a TEXT value (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Folds a content line so no line is longer than 75 octets (RFC 5545 §3.1),
 * never splitting a multi-byte character. Continuation lines start with a space.
 */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = out.length === 0 ? 75 : 74; // the leading space counts on continuation lines
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2027-02-04T18:40:00.000Z" (wall clock) -> "20270204T184000" (floating) */
export function floatingDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

/** "2027-02-04" -> "20270204" */
const icsDate = (dateOnly: string) => dateOnly.replace(/-/g, "");

const utcStamp = (d: Date) => `${floatingDateTime(d.toISOString())}Z`;

const hasTime = (iso: string) => !/T00:00:00(\.000)?Z$/.test(iso);

function itemEvent(item: CalendarItem, input: CalendarInput): string[] | null {
  if (!item.startAt) return null;
  const lines = ["BEGIN:VEVENT", `UID:item-${item.id}@tripster`, `DTSTAMP:${utcStamp(input.generatedAt)}`];

  const startDate = item.startAt.slice(0, 10);
  const endDate = item.endAt ? item.endAt.slice(0, 10) : startDate;
  const timed = !item.allDay && (hasTime(item.startAt) || (item.endAt !== null && hasTime(item.endAt)));

  if (timed) {
    lines.push(`DTSTART:${floatingDateTime(item.startAt)}`);
    if (item.endAt && item.endAt > item.startAt) lines.push(`DTEND:${floatingDateTime(item.endAt)}`);
    else lines.push("DURATION:PT1H"); // no end time given: show it as an hour
  } else {
    // All-day: DTEND is the day *after* the last day
    lines.push(`DTSTART;VALUE=DATE:${icsDate(startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(toDateOnly(addDays(parseDateOnly(endDate < startDate ? startDate : endDate), 1)))}`);
  }

  lines.push(`SUMMARY:${escapeText(`${EMOJI[item.category]} ${item.title}`)}`);

  const location =
    item.fromPlace && item.toPlace ? `${item.fromPlace} → ${item.toPlace}` : (item.fromPlace ?? item.stopName ?? null);
  if (location) lines.push(`LOCATION:${escapeText(location)}`);

  const description = [
    item.provider ? `With ${item.provider}` : null,
    item.confirmationCode ? `Confirmation: ${item.confirmationCode}` : null,
    STATUS_TEXT[item.status],
    item.notes,
    ...item.links.map((l) => `${l.label ?? linkName(l.kind)}: ${l.url}`),
    `Open in Tripster: ${input.tripUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  lines.push(`DESCRIPTION:${escapeText(description)}`);

  const firstLink = item.links[0]?.url;
  if (firstLink) lines.push(`URL:${firstLink}`);
  lines.push("END:VEVENT");
  return lines;
}

function linkName(kind: LinkKind) {
  return { BOOKING: "Booking", CONFIRMATION: "Confirmation", MAP: "Map", INFO: "Info", OTHER: "Link" }[kind];
}

function stopEvent(stop: CalendarStop, index: number, input: CalendarInput): string[] | null {
  if (!stop.arriveOn) return null;
  const last = stop.departOn && stop.departOn >= stop.arriveOn ? stop.departOn : stop.arriveOn;
  return [
    "BEGIN:VEVENT",
    `UID:stop-${stop.id}@tripster`,
    `DTSTAMP:${utcStamp(input.generatedAt)}`,
    `DTSTART;VALUE=DATE:${icsDate(stop.arriveOn)}`,
    `DTEND;VALUE=DATE:${icsDate(toDateOnly(addDays(parseDateOnly(last), 1)))}`,
    `SUMMARY:${escapeText(`📍 ${stop.name} (stop ${index + 1})`)}`,
    ...(stop.country ? [`LOCATION:${escapeText(`${stop.name}, ${stop.country}`)}`] : []),
    `DESCRIPTION:${escapeText(`Stop ${index + 1} of ${input.title}\nOpen in Tripster: ${input.tripUrl}`)}`,
    "TRANSP:TRANSPARENT", // a stop doesn't make you "busy"
    "END:VEVENT",
  ];
}

/** The whole trip as an .ics file. Undated bookings are left out. */
export function tripToIcs(input: CalendarInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tripster//Trip calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.title)}`,
    ...(input.description ? [`X-WR-CALDESC:${escapeText(input.description)}`] : []),
    // Ask subscribed calendars to check for changes every few hours
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...input.stops.flatMap((s, i) => stopEvent(s, i, input) ?? []),
    ...input.items.flatMap((item) => itemEvent(item, input) ?? []),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
