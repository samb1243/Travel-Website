// Importing bookings from emails: only the trip's planners can do it, nothing
// is saved, structured data needs no AI, and Claude is only used when asked
// (and set up). The Anthropic API is faked here: no test sends a real request.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/server/session";
import { readBookingEmail, readBookingEmailWithClaude } from "@/server/actions/email-import";
import { db, expectNotFound, makeTrip, makeUser, signInAs } from "./helpers";

// What the fake Claude returns, and what it was sent
const fake = vi.hoisted(() => ({ calls: [] as unknown[], output: null as unknown, stop: "end_turn" }));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    static AuthenticationError = AuthenticationError;
    beta = {
      messages: {
        parse: async (params: unknown) => {
          fake.calls.push(params);
          return { stop_reason: fake.stop, parsed_output: fake.output };
        },
      },
    };
  }
  return { default: Anthropic };
});

const bookingEmail = `<html><body><p>Your stay is confirmed.</p>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "LodgingReservation",
  reservationNumber: "BK-778812",
  reservationFor: { "@type": "LodgingBusiness", name: "Casa do Fado", address: { streetAddress: "Rua da Rosa 12", addressLocality: "Lisbon" } },
  checkinTime: "2027-05-01T15:00:00+01:00",
  checkoutTime: "2027-05-04T11:00:00+01:00",
  totalPrice: 255,
  priceCurrency: "EUR",
})}</script></body></html>`;

const plainEmail = {
  subject: "Your tram tour",
  html: "",
  text: "Hi Maya, your Yellow Tram tour on 2 May 2027 at 10:00 is confirmed. Ref TT-4410. Pay the driver €25 on the day.",
};

let owner: CurrentUser;
let stranger: CurrentUser;
let f: Awaited<ReturnType<typeof makeTrip>>; // Lisbon, 1-5 May 2027

beforeEach(async () => {
  owner = await makeUser("Maya");
  stranger = await makeUser("Stranger");
  f = await makeTrip(owner.id, "PUBLIC");
  fake.calls = [];
  fake.output = null;
  fake.stop = "end_turn";
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe("reading an email's booking data", () => {
  it("finds the booking, guesses the stop, and saves nothing", async () => {
    signInAs(owner);
    const before = await db.item.count({ where: { tripId: f.trip.id } });
    const r = await readBookingEmail(f.trip.id, { subject: "Booking confirmed", html: bookingEmail, text: "" });
    expect(r).toMatchObject({ ok: true, source: "data", canAskClaude: false });
    expect(r.ok && r.bookings).toEqual([
      expect.objectContaining({
        category: "ACCOMMODATION",
        title: "Casa do Fado",
        startDate: "2027-05-01",
        startTime: "15:00",
        cost: "255",
        currency: "EUR",
        confirmationCode: "BK-778812",
        stopId: f.stop.id, // "Lisbon" is in the address
      }),
    ]);
    expect(await db.item.count({ where: { tripId: f.trip.id } })).toBe(before);
    expect(fake.calls).toHaveLength(0); // no AI for structured data
  });

  it("reads HTML pasted as text", async () => {
    signInAs(owner);
    const r = await readBookingEmail(f.trip.id, { subject: "", html: "", text: bookingEmail });
    expect(r.ok && r.bookings.map((b) => b.title)).toEqual(["Casa do Fado"]);
  });

  it("offers Claude only when it's set up", async () => {
    signInAs(owner);
    expect(await readBookingEmail(f.trip.id, plainEmail)).toMatchObject({ ok: true, source: "none", bookings: [], canAskClaude: false });
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(await readBookingEmail(f.trip.id, plainEmail)).toMatchObject({ ok: true, source: "none", canAskClaude: true });
  });

  it("is only for the trip's planners", async () => {
    signInAs(stranger);
    await expectNotFound(readBookingEmail(f.trip.id, plainEmail));
    process.env.ANTHROPIC_API_KEY = "test-key";
    await expectNotFound(readBookingEmailWithClaude(f.trip.id, plainEmail));
    expect(fake.calls).toHaveLength(0);
  });

  it("refuses empty and oversized emails", async () => {
    signInAs(owner);
    expect(await readBookingEmail(f.trip.id, { subject: "", html: "", text: "  " })).toMatchObject({ ok: false });
    expect(await readBookingEmail(f.trip.id, { subject: "", html: "", text: "x".repeat(250_001) })).toMatchObject({ ok: false });
  });
});

describe("reading an email with Claude", () => {
  it("says so when it isn't set up, without calling anything", async () => {
    signInAs(owner);
    expect(await readBookingEmailWithClaude(f.trip.id, plainEmail)).toMatchObject({ ok: false, message: expect.stringContaining("isn't set up") });
    expect(fake.calls).toHaveLength(0);
  });

  it("sends only the email text, and checks what comes back", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fake.output = {
      bookings: [
        {
          category: "ACTIVITY",
          title: "Yellow Tram tour",
          provider: null,
          start_date: "2027-05-02",
          start_time: "10:00",
          end_date: null,
          end_time: null,
          from_place: null,
          to_place: null,
          address: null,
          price: 25,
          currency: "EUR",
          confirmation_code: "TT-4410",
          status: "BOOKED",
          payment: "PAY_ON_ARRIVAL",
          notes: null,
        },
        // Nonsense is blanked or dropped, never trusted
        { ...{ category: "FOOD", title: "", from_place: null, to_place: null }, provider: null, start_date: null, start_time: null, end_date: null, end_time: null, address: null, price: null, currency: null, confirmation_code: null, status: "BOOKED", payment: null, notes: null },
      ],
    };
    signInAs(owner);
    const r = await readBookingEmailWithClaude(f.trip.id, plainEmail);
    expect(r).toMatchObject({ ok: true, source: "claude" });
    expect(r.ok && r.bookings).toEqual([
      expect.objectContaining({ title: "Yellow Tram tour", startDate: "2027-05-02", payment: "PAY_ON_ARRIVAL", stopId: f.stop.id }),
    ]);

    const sent = JSON.stringify(fake.calls[0]);
    expect(sent).toContain("Yellow Tram tour on 2 May 2027");
    expect(sent).toContain('"model":"claude-opus-5-5"');
    // Nothing about the person or the trip beyond the email itself
    expect(sent).not.toContain(owner.email);
    expect(sent).not.toContain(f.trip.title);
  });

  it("turns refusals and unreadable answers into a message", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    signInAs(owner);
    fake.stop = "refusal";
    expect(await readBookingEmailWithClaude(f.trip.id, plainEmail)).toMatchObject({ ok: false });
    fake.stop = "end_turn";
    fake.output = null;
    expect(await readBookingEmailWithClaude(f.trip.id, plainEmail)).toMatchObject({ ok: false });
  });

  it("won't cut a very long email short", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    signInAs(owner);
    const r = await readBookingEmailWithClaude(f.trip.id, { subject: "", html: "", text: "booking ".repeat(10_000) });
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining("very long") });
    expect(fake.calls).toHaveLength(0);
  });
});
