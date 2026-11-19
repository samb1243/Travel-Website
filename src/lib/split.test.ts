import { describe, expect, it } from "vitest";
import { splitCents, summariseSplit } from "./split";

const maya = { id: "maya", name: "Maya" };
const ben = { id: "ben", name: "Ben" };
const aiko = { id: "aiko", name: "Aiko" };
const all = [maya, ben, aiko];

describe("splitCents", () => {
  it("splits evenly, giving leftover cents to the first people", () => {
    expect(splitCents(1000, 3)).toEqual([334, 333, 333]);
    expect(splitCents(1, 3)).toEqual([1, 0, 0]);
  });
});

describe("summariseSplit", () => {
  it("works out who owes whom, to the cent", () => {
    const s = summariseSplit(all, [
      { amount: 90, paidById: "maya", splitWith: [] }, // 30 each
      { amount: 30, paidById: "ben", splitWith: [] }, // 10 each
    ]);
    expect(s.people.map((p) => [p.id, p.paid, p.share, p.balance])).toEqual([
      ["maya", 90, 40, 50],
      ["ben", 30, 40, -10],
      ["aiko", 0, 40, -40],
    ]);
    expect(s.transfers).toEqual([
      { fromId: "aiko", toId: "maya", amount: 40 },
      { fromId: "ben", toId: "maya", amount: 10 },
    ]);
    expect(s.total).toBe(120);
  });

  it("only shares a booking among the people it's for", () => {
    const s = summariseSplit(all, [{ amount: 50, paidById: "maya", splitWith: ["maya", "ben"] }]);
    expect(s.people.find((p) => p.id === "aiko")!.share).toBe(0);
    expect(s.transfers).toEqual([{ fromId: "ben", toId: "maya", amount: 25 }]);
  });

  it("counts settle-ups, and is square when everyone's paid back", () => {
    const expenses = [{ amount: 90, paidById: "maya", splitWith: [] }];
    const half = summariseSplit(all, expenses, [{ fromId: "ben", toId: "maya", amount: 30 }]);
    expect(half.transfers).toEqual([{ fromId: "aiko", toId: "maya", amount: 30 }]);
    const done = summariseSplit(all, expenses, [
      { fromId: "ben", toId: "maya", amount: 30 },
      { fromId: "aiko", toId: "maya", amount: 30 },
    ]);
    expect(done.transfers).toEqual([]);
    expect(done.people.every((p) => p.balance === 0)).toBe(true);
  });

  it("keeps money nobody claimed separate, and skips free bookings", () => {
    const s = summariseSplit(all, [
      { amount: 40, paidById: null, splitWith: [] },
      { amount: 0, paidById: "ben", splitWith: [] },
      { amount: 12.5, paidById: "someone-who-left", splitWith: [] },
    ]);
    expect(s.unassigned).toBe(52.5);
    expect(s.total).toBe(0);
    expect(s.transfers).toEqual([]);
  });

  it("shares among everyone when the people it was for have all left", () => {
    const s = summariseSplit([maya, ben], [{ amount: 20, paidById: "maya", splitWith: ["aiko"] }]);
    expect(s.transfers).toEqual([{ fromId: "ben", toId: "maya", amount: 10 }]);
  });

  it("never creates money: balances always add up to zero", () => {
    const s = summariseSplit(all, [
      { amount: 100.01, paidById: "maya", splitWith: [] },
      { amount: 33.33, paidById: "aiko", splitWith: ["ben", "aiko"] },
      { amount: 7.77, paidById: "ben", splitWith: ["maya"] },
    ]);
    const sum = s.people.reduce((t, p) => t + Math.round(p.balance * 100), 0);
    expect(sum).toBe(0);
    const owed = s.transfers.reduce((t, x) => t + Math.round(x.amount * 100), 0);
    expect(owed).toBe(s.people.filter((p) => p.balance > 0).reduce((t, p) => t + Math.round(p.balance * 100), 0));
  });
});
