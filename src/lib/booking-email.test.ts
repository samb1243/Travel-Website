import { describe, expect, it } from "vitest";
import { addressLine, aiBookingToDraft, draftsFromStructuredData, guessStop, htmlToText, money, splitDateTime, type BookingDraft } from "./booking-email";

const email = (...blocks: unknown[]) =>
  `<html><head><title>Your booking</title></head><body><p>Thanks!</p>${blocks
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`)
    .join("")}</body></html>`;

const flight = {
  "@context": "http://schema.org",
  "@type": "FlightReservation",
  reservationNumber: "RXJ34P",
  reservationStatus: "http://schema.org/ReservationConfirmed",
  underName: { "@type": "Person", name: "Maya Chen" },
  reservationFor: {
    "@type": "Flight",
    flightNumber: "917",
    airline: { "@type": "Airline", name: "Thai Airways", iataCode: "TG" },
    departureAirport: { "@type": "Airport", name: "London Heathrow", iataCode: "LHR" },
    departureTime: "2027-01-31T21:30:00+00:00",
    arrivalAirport: { "@type": "Airport", name: "Bangkok Suvarnabhumi", iataCode: "BKK" },
    arrivalTime: "2027-02-01T15:05:00+07:00",
  },
  totalPrice: "640.00",
  priceCurrency: "GBP",
  paymentStatus: "http://schema.org/PaymentComplete",
};

const hotel = {
  "@context": "https://schema.org",
  "@type": "LodgingReservation",
  reservationNumber: "4410293387",
  reservationStatus: "ReservationConfirmed",
  broker: { "@type": "Organization", name: "Booking.com" },
  reservationFor: {
    "@type": "LodgingBusiness",
    name: "Lub d Bangkok Silom",
    address: { "@type": "PostalAddress", streetAddress: "4 Decho Rd", addressLocality: "Bangkok", postalCode: "10500", addressCountry: "TH" },
  },
  checkinTime: "2027-02-01T14:00:00+07:00",
  checkoutTime: "2027-02-04T11:00:00+07:00",
  price: "1,850",
  priceCurrency: "THB",
};

describe("draftsFromStructuredData", () => {
  it("reads a flight, keeping local times as written", () => {
    expect(draftsFromStructuredData(email(flight))).toEqual([
      expect.objectContaining({
        category: "FLIGHT",
        title: "TG 917",
        provider: "Thai Airways",
        startDate: "2027-01-31",
        startTime: "21:30",
        endDate: "2027-02-01",
        endTime: "15:05",
        fromPlace: "London Heathrow (LHR)",
        toPlace: "Bangkok Suvarnabhumi (BKK)",
        cost: "640",
        currency: "GBP",
        confirmationCode: "RXJ34P",
        status: "BOOKED",
        payment: "PAID",
      }),
    ]);
  });

  it("reads a hotel booked through Booking.com, with its address and price", () => {
    const [d] = draftsFromStructuredData(email(hotel));
    expect(d).toMatchObject({
      category: "ACCOMMODATION",
      title: "Lub d Bangkok Silom",
      provider: "Booking.com",
      startDate: "2027-02-01",
      startTime: "14:00",
      endDate: "2027-02-04",
      endTime: "11:00",
      address: "4 Decho Rd, 10500 Bangkok, TH",
      cost: "1850",
      currency: "THB",
      payment: "",
    });
  });

  it("reads buses, restaurants and events too", () => {
    const bus = {
      "@type": "BusReservation",
      reservationNumber: "GR-11823",
      reservationFor: {
        "@type": "BusTrip",
        busName: "VIP sleeper",
        busCompany: { name: "Green Bus" },
        departureBusStop: { name: "Chiang Mai Arcade", address: "Kaeo Nawarat Rd, Chiang Mai" },
        arrivalBusStop: { name: "Chiang Rai Terminal 1" },
        departureTime: "2027-02-08T08:00:00",
      },
    };
    const dinner = {
      "@type": "FoodEstablishmentReservation",
      partySize: 2,
      startTime: "2027-02-06T19:30:00",
      reservationFor: { "@type": "Restaurant", name: "Khao Soi Mae Sai", address: "29/1 Ratchaphuek Rd, Chiang Mai" },
    };
    const show = {
      "@type": "EventReservation",
      reservationNumber: "TKT-55",
      reservationFor: { "@type": "Event", name: "Muay Thai at Rajadamnern", startDate: "2027-02-02T18:30:00", location: { name: "Rajadamnern Stadium" } },
    };
    const drafts = draftsFromStructuredData(email([bus, dinner], show));
    expect(drafts.map((d) => [d.category, d.title, d.startDate, d.startTime])).toEqual([
      ["TRANSPORT", "VIP sleeper", "2027-02-08", "08:00"],
      ["FOOD", "Khao Soi Mae Sai", "2027-02-06", "19:30"],
      ["ACTIVITY", "Muay Thai at Rajadamnern", "2027-02-02", "18:30"],
    ]);
    expect(drafts[0]).toMatchObject({ provider: "Green Bus", fromPlace: "Chiang Mai Arcade", address: "Kaeo Nawarat Rd, Chiang Mai" });
    expect(drafts[1].notes).toBe("Table for 2");
    expect(drafts[2].address).toBe("Rajadamnern Stadium");
  });

  it("unpacks packages and @graph, skips cancellations and repeats, and ignores broken JSON", () => {
    const cancelled = { ...hotel, reservationStatus: "http://schema.org/ReservationCancelled" };
    const html =
      email({ "@type": "ReservationPackage", subReservation: [flight, flight] }, { "@graph": [cancelled, { "@type": "Organization", name: "Shop" }] }) +
      '<script type="application/ld+json">{ not json </script>';
    expect(draftsFromStructuredData(html).map((d) => d.title)).toEqual(["TG 917"]);
  });

  it("finds nothing in an email without structured data", () => {
    expect(draftsFromStructuredData("<p>Your bus leaves at 8am</p>")).toEqual([]);
  });
});

describe("helpers", () => {
  it("splitDateTime keeps the local time and accepts dates alone", () => {
    expect(splitDateTime("2027-02-04T18:40:00+07:00")).toEqual({ date: "2027-02-04", time: "18:40" });
    expect(splitDateTime("2027-02-04")).toEqual({ date: "2027-02-04", time: "" });
    expect(splitDateTime("tomorrow")).toEqual({ date: "", time: "" });
  });

  it("money drops currencies the app doesn't know and nonsense amounts", () => {
    expect(money("1,234.50", "eur")).toEqual({ cost: "1234.5", currency: "EUR" });
    expect(money(12, "LAK")).toEqual({ cost: "12", currency: "" });
    expect(money("", "EUR")).toEqual({ cost: "", currency: "" });
  });

  it("addressLine joins the parts of an address", () => {
    expect(addressLine({ streetAddress: "1 Rue X", addressLocality: "Paris", addressCountry: { name: "France" } })).toBe("1 Rue X, Paris, France");
    expect(addressLine("Somewhere 5")).toBe("Somewhere 5");
  });

  it("htmlToText drops markup and hidden parts but keeps the words", () => {
    const html =
      "<html><head><style>p{color:red}</style></head><body><script>alert(1)</script><table><tr><td>Check-in</td><td>1 Feb&nbsp;2027</td></tr></table><p>Price: &euro;45 &amp; tax</p><!-- tracking --></body></html>";
    expect(htmlToText(html)).toBe("Check-in 1 Feb 2027\n\nPrice: €45 & tax");
  });
});

describe("guessStop", () => {
  const stops = [
    { id: "bkk", name: "Bangkok", arriveOn: "2027-02-01", departOn: "2027-02-04" },
    { id: "cnx", name: "Chiang Mai", arriveOn: "2027-02-04", departOn: "2027-02-08" },
  ];
  const d = (over: Partial<BookingDraft>): BookingDraft => ({
    category: "ACTIVITY",
    title: "",
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
    ...over,
  });

  it("matches a stop named in the address or title", () => {
    expect(guessStop(d({ category: "ACCOMMODATION", address: "4 Decho Rd, Bangkok" }), stops)).toBe("bkk");
  });

  it("files a journey under the stop you leave from", () => {
    expect(guessStop(d({ category: "TRANSPORT", fromPlace: "Bangkok Hua Lamphong", toPlace: "Chiang Mai" }), stops)).toBe("bkk");
  });

  it("falls back to where you are on that date, then the whole trip", () => {
    expect(guessStop(d({ title: "Cooking class", startDate: "2027-02-05" }), stops)).toBe("cnx");
    expect(guessStop(d({ title: "Travel insurance" }), stops)).toBeNull();
  });
});

describe("aiBookingToDraft", () => {
  const ai = (over: Partial<import("./booking-email").AiBooking> = {}): import("./booking-email").AiBooking => ({
    category: "TRANSPORT",
    title: "Minivan to Pai",
    provider: "Prempracha",
    start_date: "2027-02-08",
    start_time: "10:30",
    end_date: null,
    end_time: null,
    from_place: "Chiang Mai Arcade",
    to_place: "Pai",
    address: null,
    price: 250,
    currency: "THB",
    confirmation_code: "PP-2231",
    status: "BOOKED",
    payment: "PAY_ON_ARRIVAL",
    notes: null,
    ...over,
  });

  it("turns Claude's reading into form values", () => {
    expect(aiBookingToDraft(ai())).toMatchObject({
      category: "TRANSPORT",
      title: "Minivan to Pai",
      startDate: "2027-02-08",
      startTime: "10:30",
      cost: "250",
      currency: "THB",
      status: "BOOKED",
      payment: "PAY_ON_ARRIVAL",
      confirmationCode: "PP-2231",
    });
  });

  it("blanks out anything not in the expected form instead of trusting it", () => {
    const d = aiBookingToDraft(ai({ start_date: "8th Feb", start_time: "25:99", currency: "LAK", end_date: "2027-02-30", end_time: "12:00" }))!;
    expect([d.startDate, d.startTime, d.currency, d.endDate, d.endTime]).toEqual(["", "", "", "", ""]);
  });

  it("gives gear and other buying statuses and no payment status", () => {
    expect(aiBookingToDraft(ai({ category: "OTHER", title: "Travel insurance", status: "BOOKED", payment: "PAID" }))).toMatchObject({
      status: "BOUGHT",
      payment: "",
    });
  });

  it("skips bookings with no name and no route", () => {
    expect(aiBookingToDraft(ai({ title: " ", from_place: null }))).toBeNull();
  });
});
