// Bookings priced in another currency: stored in their own currency, converted
// into the trip's currency for totals, and kept honest when the trip's
// currency changes. Rates are fixed here so no test touches the network.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveItem } from "@/server/actions/builder";
import { updateTrip } from "@/server/actions/trips";
import { getSharedTrip } from "@/server/shared-trips";
import { getTripBuilderData } from "@/server/trips";
import type { CurrentUser } from "@/server/session";
import type { ItemFormInput } from "@/lib/validation/item";
import { RedirectError } from "./errors";
import { db, makeTrip, makeUser, signInAs } from "./helpers";

vi.mock("@/server/rates", async () => {
  const { APPROX_RATES } = await import("@/lib/convert");
  const table = { ...APPROX_RATES, EUR: 1, USD: 1.1, JPY: 175 };
  return { getRates: async () => ({ table, day: "2026-11-18", source: "live" }) };
});

const item = (title: string, stopId: string, cost: string, currency?: string): ItemFormInput => ({
  stopId,
  category: "ACTIVITY",
  title,
  provider: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  fromPlace: "",
  toPlace: "",
  cost,
  currency,
  status: "TO_BOOK",
  confirmationCode: "",
  notes: "",
  privateNotes: "",
  links: [],
});

function tripForm(currency: string) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({
    title: "Currency trip",
    types: "OTHER",
    startDate: "",
    endDate: "",
    currency,
    budget: "",
    travellers: "1",
    description: "",
    coverImageUrl: "",
  })) fd.set(k, v);
  return fd;
}

let owner: CurrentUser;
let f: Awaited<ReturnType<typeof makeTrip>>; // EUR trip with a €300 guesthouse

const totalCost = async () =>
  Number((await db.trip.findUniqueOrThrow({ where: { id: f.trip.id }, select: { totalCost: true } })).totalCost);

beforeEach(async () => {
  owner = await makeUser("Kenji");
  f = await makeTrip(owner.id, "PUBLIC");
  signInAs(owner);
});

describe("pricing a booking in another currency", () => {
  it("keeps the yen price and converts it for the trip total", async () => {
    const r = (await saveItem(f.trip.id, null, item("Sumo morning practice", f.stop.id, "14000", "JPY"))) as { ok: boolean; id: string };
    expect(r.ok).toBe(true);

    const saved = await db.item.findUniqueOrThrow({ where: { id: r.id } });
    expect(saved.currency).toBe("JPY");
    expect(Number(saved.cost)).toBe(14000);
    expect(await totalCost()).toBe(380); // €300 + ¥14,000 at 175 per euro

    const data = await getTripBuilderData(f.trip.id, owner.id);
    const built = data!.stops.flatMap((s) => s.items).find((i) => i.id === r.id)!;
    expect(built.currency).toBe("JPY");
    expect(built.costInTripCurrency).toBe(80);
  });

  it("stores a price in the trip's own currency without a tag", async () => {
    const r = (await saveItem(f.trip.id, null, item("Tram 28", f.stop.id, "3", "EUR"))) as { id: string };
    expect((await db.item.findUniqueOrThrow({ where: { id: r.id } })).currency).toBeNull();
  });

  it("rejects currencies the app doesn't know", async () => {
    const r = await saveItem(f.trip.id, null, item("Mystery coin", f.stop.id, "1", "BTC"));
    expect(r).toMatchObject({ ok: false, errors: { currency: expect.any(String) } });
    expect(await db.item.count({ where: { tripId: f.trip.id } })).toBe(1);
  });

  it("shows the converted price on the public page too", async () => {
    await saveItem(f.trip.id, null, item("Sumo morning practice", f.stop.id, "14000", "JPY"));
    signInAs(null);
    const shared = await getSharedTrip(f.trip.slug, null);
    const sumo = shared!.stops.flatMap((s) => s.items).find((i) => i.title === "Sumo morning practice")!;
    expect(sumo).toMatchObject({ currency: "JPY", costInTripCurrency: 80 });
  });
});

describe("changing the trip's currency", () => {
  it("keeps every price in the currency it was entered in", async () => {
    await saveItem(f.trip.id, null, item("Sumo morning practice", f.stop.id, "14000", "JPY"));
    const { id: dollarItem } = (await saveItem(f.trip.id, null, item("Ferry", f.stop.id, "11", "USD"))) as { id: string };

    const err = await updateTrip(f.trip.id, {}, tripForm("USD")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RedirectError);

    const items = await db.item.findMany({ where: { tripId: f.trip.id }, orderBy: { createdAt: "asc" } });
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i.currency]));
    expect(byTitle["Guesthouse in Alfama"]).toBe("EUR"); // the €300 stays €300
    expect(byTitle["Sumo morning practice"]).toBe("JPY");
    expect((await db.item.findUniqueOrThrow({ where: { id: dollarItem } })).currency).toBeNull(); // now the trip currency

    // $330 + $88 + $11
    expect(await totalCost()).toBe(429);
  });
});
