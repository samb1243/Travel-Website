"use server";

import { z } from "zod";
import { draftsFromStructuredData, guessStop, htmlToText, looksLikeHtml, MAX_EMAIL_CHARS, type BookingDraft } from "@/lib/booking-email";
import { db } from "@/lib/db";
import { toDateOnly } from "@/lib/dates";
import { requireTripEditor } from "@/server/permissions";
import { rateLimit } from "@/server/rate-limit";
import { aiReadingAvailable, EmailReadError, readBookingsWithClaude } from "@/server/booking-email";

// Import bookings from a confirmation email. The browser sends the email's
// subject, HTML and text (an uploaded .eml file is opened in the browser, so
// attachments never leave the device). Nothing is saved here: the bookings
// found come back as drafts for the item form.

export type FoundBooking = BookingDraft & { stopId: string | null };

export type EmailImportResult =
  | { ok: true; source: "data" | "claude" | "none"; bookings: FoundBooking[]; canAskClaude: boolean }
  | { ok: false; message: string };

const emailInput = z.object({
  subject: z.string().max(500).default(""),
  html: z.string().max(1_500_000).default(""),
  text: z.string().max(500_000).default(""),
});

type EmailInput = z.input<typeof emailInput>;

async function withStops(tripId: string, drafts: BookingDraft[]): Promise<FoundBooking[]> {
  const stops = await db.stop.findMany({
    where: { tripId },
    orderBy: { position: "asc" },
    select: { id: true, name: true, arriveOn: true, departOn: true },
  });
  const list = stops.map((s) => ({
    id: s.id,
    name: s.name,
    arriveOn: s.arriveOn ? toDateOnly(s.arriveOn) : null,
    departOn: s.departOn ? toDateOnly(s.departOn) : null,
  }));
  return drafts.slice(0, 20).map((d) => ({ ...d, stopId: guessStop(d, list) }));
}

/** Pasted text may really be HTML (from "show original"); either way, both forms. */
function normalise(input: z.output<typeof emailInput>) {
  const html = input.html || (looksLikeHtml(input.text) ? input.text : "");
  const text = (input.text && !looksLikeHtml(input.text) ? input.text : htmlToText(html)).trim();
  return { subject: input.subject.trim(), html, text };
}

/** Step 1: the structured booking data in the email, if any. Free; nothing leaves the server. */
export async function readBookingEmail(tripId: string, input: EmailInput): Promise<EmailImportResult> {
  await requireTripEditor(tripId);
  const parsed = emailInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That email is too big. Paste just the part with the booking." };
  const email = normalise(parsed.data);
  if (!email.html && !email.text) return { ok: false, message: "Paste an email, or choose a saved .eml file." };

  const drafts = email.html ? draftsFromStructuredData(email.html) : [];
  return {
    ok: true,
    source: drafts.length ? "data" : "none",
    bookings: await withStops(tripId, drafts),
    canAskClaude: aiReadingAvailable() && email.text.length > 0,
  };
}

/** Step 2, only when the person asks: Claude reads the email's text. */
export async function readBookingEmailWithClaude(tripId: string, input: EmailInput): Promise<EmailImportResult> {
  const user = await requireTripEditor(tripId);
  if (!aiReadingAvailable()) return { ok: false, message: "Reading emails with Claude isn't set up on this server." };
  if (!rateLimit(`email-ai:${user.id}`, 10, 60 * 60 * 1000)) {
    return { ok: false, message: "That's 10 emails read with Claude this hour. Try again later, or add bookings by hand." };
  }
  const parsed = emailInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That email is too big. Paste just the part with the booking." };
  const email = normalise(parsed.data);
  if (!email.text) return { ok: false, message: "There's no text in that email to read." };
  // Never cut an email short silently: it could drop a booking
  if (email.text.length > MAX_EMAIL_CHARS) {
    return { ok: false, message: "That email is very long. Paste just the part with the booking and try again." };
  }

  try {
    const drafts = await readBookingsWithClaude(email.text, email.subject);
    return { ok: true, source: "claude", bookings: await withStops(tripId, drafts), canAskClaude: false };
  } catch (e) {
    if (e instanceof EmailReadError) return { ok: false, message: e.message };
    console.error("[email-import]", e);
    return { ok: false, message: "Something went wrong reading that email. Try again, or add the booking by hand." };
  }
}
