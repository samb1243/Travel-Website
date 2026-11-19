// "Ideas from other travellers": public trips only, at least 3 different
// travellers, nothing personal, and only for stops you can edit.

import { beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/server/session";
import type { Visibility } from "@/generated/prisma/enums";
import { loadStopIdeas } from "@/server/actions/recommendations";
import { db, expectNotFound, makeTrip, makeUser, SECRET_CODE, SECRET_NOTE, signInAs } from "./helpers";

let me: CurrentUser;
let mine: Awaited<ReturnType<typeof makeTrip>>; // has a stop in Lisbon, PT

/** Someone else's trip through Lisbon with the given plans */
async function lisbonTrip(visibility: Visibility, items: { title: string; cost?: number; category?: "ACTIVITY" | "FOOD" | "ACCOMMODATION" }[], owner?: CurrentUser) {
  const who = owner ?? (await makeUser("Traveller"));
  const t = await makeTrip(who.id, visibility, `Lisbon ${Math.random().toString(36).slice(2, 7)}`);
  await db.item.createMany({
    data: items.map((i) => ({
      tripId: t.trip.id,
      stopId: t.stop.id,
      category: i.category ?? "ACTIVITY",
      title: i.title,
      cost: i.cost ?? null,
      status: "NOT_NEEDED" as const,
      notes: "Shared note on " + i.title,
      privateNotes: SECRET_NOTE,
      confirmationCode: SECRET_CODE,
    })),
  });
  return { ...t, owner: who };
}

async function ideas() {
  signInAs(me);
  const r = await loadStopIdeas(mine.stop.id);
  if (!r.ok) throw new Error(r.message);
  return r.ideas;
}

beforeEach(async () => {
  me = await makeUser("Me");
  mine = await makeTrip(me.id, "PRIVATE", "My Lisbon");
});

describe("ideas from other travellers", () => {
  it("shows plans at least three people have in public trips through the same place", async () => {
    for (let i = 0; i < 3; i++) await lisbonTrip("PUBLIC", [{ title: "Tram 28 ride", cost: 3 }]);
    await lisbonTrip("PUBLIC", [{ title: "Fado night" }]);
    await lisbonTrip("PUBLIC", [{ title: "Fado night" }]);

    const list = await ideas();
    const tram = list.find((i) => i.title === "Tram 28 ride");
    expect(tram).toMatchObject({ category: "ACTIVITY", travellers: 3, typicalPrice: 3, priceBasis: "person" });
    expect(list.find((i) => i.title === "Fado night")).toBeUndefined(); // only two people
  });

  it("never counts private or link-only trips", async () => {
    await lisbonTrip("PUBLIC", [{ title: "Hidden bar" }]);
    await lisbonTrip("PUBLIC", [{ title: "Hidden bar" }]);
    await lisbonTrip("PRIVATE", [{ title: "Hidden bar" }]);
    await lisbonTrip("UNLISTED", [{ title: "Hidden bar" }]);
    expect((await ideas()).map((i) => i.title)).not.toContain("Hidden bar");
  });

  it("counts each traveller once, and never your own trips", async () => {
    const regular = await makeUser("Regular");
    for (let i = 0; i < 3; i++) await lisbonTrip("PUBLIC", [{ title: "Pastéis de Belém", category: "FOOD" }], regular);
    await lisbonTrip("PUBLIC", [{ title: "Pastéis de Belém", category: "FOOD" }]);
    // My own public trips don't vote either
    await lisbonTrip("PUBLIC", [{ title: "Pastéis de Belém", category: "FOOD" }], me);
    expect((await ideas()).map((i) => i.title)).not.toContain("Pastéis de Belém");
  });

  it("returns only public trip fields: no notes, confirmations or who planned it", async () => {
    const trips = [];
    for (let i = 0; i < 3; i++) trips.push(await lisbonTrip("PUBLIC", [{ title: "Sintra day trip" }]));
    signInAs(me);
    const json = JSON.stringify(await loadStopIdeas(mine.stop.id));
    expect(json).toContain("Sintra day trip");
    for (const secret of [SECRET_CODE, SECRET_NOTE, "Shared note on", ...trips.flatMap((t) => [t.owner.name, t.owner.id, t.trip.id, t.trip.title])]) {
      expect(json).not.toContain(secret);
    }
  });

  it("marks ideas you already have", async () => {
    for (let i = 0; i < 3; i++) await lisbonTrip("PUBLIC", [{ title: "Guesthouse in Alfama", category: "ACCOMMODATION" }]);
    // makeTrip gives my stop a "Guesthouse in Alfama" stay already
    expect((await ideas()).find((i) => i.title === "Guesthouse in Alfama")?.alreadyPlanned).toBe(true);
  });

  it("is only for stops you can edit, and saves nothing", async () => {
    const stranger = await makeUser("Stranger");
    signInAs(stranger);
    await expectNotFound(loadStopIdeas(mine.stop.id));
    signInAs(null);
    await expect(loadStopIdeas(mine.stop.id)).rejects.toBeTruthy();

    const before = await db.item.count();
    await ideas();
    expect(await db.item.count()).toBe(before);
  });
});
