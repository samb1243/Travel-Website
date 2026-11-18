// Turning a booking confirmation email into bookings you can add to a trip.
// Pure functions (unit-tested). The flow lives in src/server/booking-email.ts:
//
//   1. Structured data: many airlines, hotels, Booking.com, rail and event
//      sites put the booking in the email as schema.org JSON-LD (the data
//      Gmail uses for its trip cards). Read reliably, nothing leaves the server.
//   2. Otherwise Claude can read the email text, only when the person asks.
//
// Either way the result is a draft: shown in the normal item form to check
// and change before anything is saved.

import { CURRENCY_CODES } from "@/lib/currencies";
import type { ItemCategory } from "@/generated/prisma/enums";
import type { ItemStatus, PaymentStatus } from "@/lib/status";

/** A booking found in an email, as values for the item form ("" = not found) */
export type BookingDraft = {
  category: ItemCategory;
  title: string;
  provider: string;
  /** "YYYY-MM-DD" and "HH:MM", local time where it happens */
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  fromPlace: string;
  toPlace: string;
  address: string;
  cost: string;
  currency: string;
  status: ItemStatus;
  payment: PaymentStatus | "";
  confirmationCode: string;
  notes: string;
};

export const MAX_EMAIL_CHARS = 60_000;

const EMPTY: Omit<BookingDraft, "category" | "title"> = {
  provider: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  fromPlace: "",
  toPlace: "",
  address: "",
  cost: "",
  currency: "",
  status: "BOOKED",
  payment: "",
  confirmationCode: "",
  notes: "",
};

// --- Small helpers ----------------------------------------------------------------

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const clip = (v: string, max: number) => (v.length > max ? v.slice(0, max).trim() : v);
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const nameOf = (v: unknown): string => str(v) || str(obj(v)?.name);

/** "2027-02-04T18:40:00+07:00" → date "2027-02-04", time "18:40" (the local time as written) */
export function splitDateTime(value: unknown): { date: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(str(value));
  return m ? { date: m[1], time: m[2] ?? "" } : { date: "", time: "" };
}

/** A schema.org address (text or PostalAddress) as one line */
export function addressLine(v: unknown): string {
  if (typeof v === "string") return v.trim();
  const a = obj(v);
  if (!a) return "";
  return [str(a.streetAddress), str(a.postalCode) && str(a.addressLocality) ? `${str(a.postalCode)} ${str(a.addressLocality)}` : str(a.addressLocality), nameOf(a.addressCountry)]
    .filter(Boolean)
    .join(", ");
}

/** "Bangkok Suvarnabhumi (BKK)" from an airport or station */
const placeName = (v: unknown): string => {
  const p = obj(v);
  if (!p) return str(v);
  const name = str(p.name);
  const code = str(p.iataCode);
  if (name && code && !name.includes(code)) return `${name} (${code})`;
  return name || code || str(obj(p.address)?.addressLocality);
};

/** A price and currency, kept only when the currency is one the app knows */
export function money(amount: unknown, currency: unknown): { cost: string; currency: string } {
  const n = typeof amount === "number" ? amount : Number(str(amount).replace(/[^\d.]/g, ""));
  const cur = str(currency).toUpperCase();
  if (!Number.isFinite(n) || n < 0 || str(amount) === "") return { cost: "", currency: "" };
  return { cost: String(Math.round(n * 100) / 100), currency: (CURRENCY_CODES as readonly string[]).includes(cur) ? cur : "" };
}

// --- Structured data (schema.org JSON-LD) ---------------------------------------------

/** Every JSON-LD object in an HTML email, flattened (arrays and @graph unpacked) */
export function jsonLdObjects(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const add = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(add);
    else if (obj(v)) {
      const o = obj(v)!;
      if (Array.isArray(o["@graph"])) add(o["@graph"]);
      else out.push(o);
    }
  };
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      add(JSON.parse(m[1].trim()));
    } catch {
      // not valid JSON: skip it
    }
  }
  return out;
}

const typeOf = (o: Record<string, unknown>) => {
  const t = o["@type"];
  return (Array.isArray(t) ? str(t[0]) : str(t)).replace(/^https?:\/\/schema\.org\//, "");
};

const PAYMENT: Record<string, PaymentStatus> = {
  PaymentComplete: "PAID",
  PaymentAutomaticallyApplied: "PAID",
  PaymentDue: "TO_PAY",
  PaymentPastDue: "TO_PAY",
};

/** One schema.org reservation as a draft, or null for anything else (or a cancellation) */
export function reservationToDraft(r: Record<string, unknown>): BookingDraft | null {
  const type = typeOf(r);
  if (!type.endsWith("Reservation")) return null;
  if (/Cancelled/i.test(str(r.reservationStatus))) return null;

  const what = obj(r.reservationFor) ?? {};
  const price = money(r.totalPrice ?? r.price, r.priceCurrency);
  const paymentKey = str(r.paymentStatus).replace(/^https?:\/\/schema\.org\//, "");
  const base = {
    ...EMPTY,
    ...price,
    confirmationCode: clip(str(r.reservationNumber), 100),
    status: (/Pending|Hold/i.test(str(r.reservationStatus)) ? "TO_BOOK" : "BOOKED") as ItemStatus,
    payment: PAYMENT[paymentKey] ?? "",
  };
  const by = nameOf(r.provider) || nameOf(r.broker) || nameOf(what.provider);

  switch (type) {
    case "FlightReservation": {
      const dep = splitDateTime(what.departureTime);
      const arr = splitDateTime(what.arrivalTime);
      const airline = obj(what.airline);
      const code = [str(airline?.iataCode), str(what.flightNumber)].filter(Boolean).join(" ");
      return {
        ...base,
        category: "FLIGHT",
        title: clip(code, 150),
        provider: clip(nameOf(airline) || by, 100),
        startDate: dep.date,
        startTime: dep.time,
        endDate: arr.date,
        endTime: arr.time,
        fromPlace: clip(placeName(what.departureAirport), 150),
        toPlace: clip(placeName(what.arrivalAirport), 150),
      };
    }
    case "LodgingReservation": {
      const inn = splitDateTime(r.checkinTime ?? r.checkinDate);
      const out = splitDateTime(r.checkoutTime ?? r.checkoutDate);
      return {
        ...base,
        category: "ACCOMMODATION",
        title: clip(nameOf(what), 150),
        provider: clip(by, 100),
        startDate: inn.date,
        startTime: inn.time,
        endDate: out.date,
        endTime: out.time,
        address: clip(addressLine(what.address), 300),
      };
    }
    case "TrainReservation":
    case "BusReservation":
    case "BoatReservation": {
      const dep = splitDateTime(what.departureTime);
      const arr = splitDateTime(what.arrivalTime);
      const from = what.departureStation ?? what.departureBusStop ?? what.departureBoatTerminal;
      const to = what.arrivalStation ?? what.arrivalBusStop ?? what.arrivalBoatTerminal;
      const name = str(what.trainName) || str(what.busName) || [str(what.trainNumber), str(what.busNumber)].filter(Boolean).join(" ");
      return {
        ...base,
        category: "TRANSPORT",
        title: clip(name, 150),
        provider: clip(nameOf(what.provider) || nameOf(what.busCompany) || by, 100),
        startDate: dep.date,
        startTime: dep.time,
        endDate: arr.date,
        endTime: arr.time,
        fromPlace: clip(placeName(from), 150),
        toPlace: clip(placeName(to), 150),
        address: clip(addressLine(obj(from)?.address), 300),
      };
    }
    case "RentalCarReservation": {
      const pick = splitDateTime(r.pickupTime);
      const drop = splitDateTime(r.dropoffTime);
      return {
        ...base,
        category: "TRANSPORT",
        title: clip(["Car rental", nameOf(what.brand), str(what.model)].filter(Boolean).join(" "), 150),
        provider: clip(nameOf(what.rentalCompany) || by, 100),
        startDate: pick.date,
        startTime: pick.time,
        endDate: drop.date,
        endTime: drop.time,
        fromPlace: clip(placeName(r.pickupLocation), 150),
        toPlace: clip(placeName(r.dropoffLocation), 150),
        address: clip(addressLine(obj(r.pickupLocation)?.address), 300),
      };
    }
    case "FoodEstablishmentReservation": {
      const start = splitDateTime(r.startTime ?? what.startDate);
      return {
        ...base,
        category: "FOOD",
        title: clip(nameOf(what), 150),
        provider: clip(by, 100),
        startDate: start.date,
        startTime: start.time,
        address: clip(addressLine(what.address), 300),
        notes: str(r.partySize) ? `Table for ${str(r.partySize)}` : "",
      };
    }
    default: {
      // EventReservation, TaxiReservation and any other kind: a dated activity
      const start = splitDateTime(what.startDate ?? r.startTime ?? r.pickupTime);
      const end = splitDateTime(what.endDate ?? r.endTime);
      const venue = obj(what.location);
      return {
        ...base,
        category: "ACTIVITY",
        title: clip(nameOf(what) || type.replace(/Reservation$/, ""), 150),
        provider: clip(by, 100),
        startDate: start.date,
        startTime: start.time,
        endDate: end.date,
        endTime: end.time,
        address: clip([str(venue?.name), addressLine(venue?.address)].filter(Boolean).join(", "), 300),
      };
    }
  }
}

/** Every booking in the email's structured data, one per reservation (packages unpacked) */
export function draftsFromStructuredData(html: string): BookingDraft[] {
  const reservations: Record<string, unknown>[] = [];
  for (const o of jsonLdObjects(html)) {
    const sub = o.subReservation;
    if (typeOf(o) === "ReservationPackage" && Array.isArray(sub)) sub.forEach((s) => obj(s) && reservations.push(obj(s)!));
    else reservations.push(o);
  }
  const drafts = reservations.map(reservationToDraft).filter((d): d is BookingDraft => d !== null && Boolean(d.title || (d.fromPlace && d.toPlace)));
  // Emails often repeat the same reservation (one block per passenger)
  const seen = new Set<string>();
  return drafts.filter((d) => {
    const key = [d.category, d.title, d.startDate, d.startTime, d.fromPlace, d.confirmationCode].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- Email text --------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", pound: "£", yen: "¥" };

/** Readable text from an HTML email: no tags, scripts or styles, sensible line breaks */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head|title)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
      }
      return ENTITIES[e.toLowerCase()] ?? all;
    })
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Pasted text that is really HTML (copied from "show original") */
export const looksLikeHtml = (text: string) => /<(html|body|table|div|p|br)[\s>/]/i.test(text);

// --- Which stop a booking belongs to ----------------------------------------------------

type StopLike = { id: string; name: string; arriveOn: string | null; departOn: string | null };

/**
 * The stop a booking most likely belongs to: one whose name appears in it
 * (journeys go with the stop you leave from), else the stop you're at on its
 * date. Null = the whole trip.
 */
export function guessStop(d: BookingDraft, stops: StopLike[]): string | null {
  const text = (...parts: string[]) => parts.join(" ").toLowerCase();
  const hay =
    d.category === "FLIGHT" || d.category === "TRANSPORT"
      ? [text(d.fromPlace, d.address), text(d.title), text(d.toPlace)]
      : [text(d.address, d.title, d.toPlace, d.fromPlace)];
  for (const h of hay) {
    const hit = stops.find((s) => s.name.length >= 3 && h.includes(s.name.toLowerCase()));
    if (hit) return hit.id;
  }
  if (d.startDate) {
    const at = stops.find((s) => s.arriveOn && s.arriveOn <= d.startDate && (!s.departOn || d.startDate < s.departOn));
    if (at) return at.id;
  }
  return null;
}

// --- Bookings read by Claude ------------------------------------------------------------

/** One booking as Claude returns it (see the schema in src/server/booking-email.ts) */
export type AiBooking = {
  category: ItemCategory;
  title: string;
  provider: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  from_place: string | null;
  to_place: string | null;
  address: string | null;
  price: number | null;
  currency: string | null;
  confirmation_code: string | null;
  status: "BOOKED" | "TO_BOOK";
  payment: PaymentStatus | null;
  notes: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Claude's reading of a booking, checked like any other input: dates and times
 * must be real formats, the currency one the app knows, statuses that fit the
 * kind of item. Anything off is left blank for the person to fill in.
 */
export function aiBookingToDraft(b: AiBooking): BookingDraft | null {
  const s = (v: string | null, max: number) => clip((v ?? "").replace(/\s+/g, " ").trim(), max);
  const title = s(b.title, 150);
  const fromPlace = s(b.from_place, 150);
  const toPlace = s(b.to_place, 150);
  if (!title && !(fromPlace && toPlace)) return null;
  const purchase = b.category === "GEAR" || b.category === "OTHER";
  // A real calendar date (30 February is not; Date.parse would roll it into March)
  const date = (v: string | null) => {
    if (!v || !DATE.test(v)) return "";
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : "";
  };
  const time = (v: string | null) => (v && TIME.test(v) ? v : "");
  return {
    category: b.category,
    title,
    provider: s(b.provider, 100),
    startDate: date(b.start_date),
    startTime: date(b.start_date) ? time(b.start_time) : "",
    endDate: date(b.end_date),
    endTime: date(b.end_date) ? time(b.end_time) : "",
    fromPlace,
    toPlace,
    address: s(b.address, 300),
    ...money(b.price ?? "", b.currency),
    status: purchase ? (b.status === "BOOKED" ? "BOUGHT" : "TO_BUY") : b.status === "TO_BOOK" ? "TO_BOOK" : "BOOKED",
    payment: purchase ? "" : (b.payment ?? ""),
    confirmationCode: s(b.confirmation_code, 100),
    notes: clip((b.notes ?? "").trim(), 2000),
  };
}
