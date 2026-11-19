// Splitting costs on a trip planned together: who paid what, who owes whom,
// and the fewest payments that settle it. Pure functions on whole cents
// (unit-tested), all in the trip's currency.

import { fromCents, toCents } from "@/lib/money";

export type SplitPerson = { id: string; name: string };

/** A booking with a price someone paid. `splitWith` empty = everyone on the trip. */
export type SplitExpense = { amount: number; paidById: string | null; splitWith: string[] };

/** Money handed over to settle up: `from` paid `to` back. */
export type SplitPayment = { fromId: string; toId: string; amount: number };

export type PersonBalance = {
  id: string;
  name: string;
  /** What they paid for bookings */
  paid: number;
  /** Their share of the bookings they're part of */
  share: number;
  /** Positive: others owe them. Negative: they owe. After settle-ups. */
  balance: number;
};

export type Transfer = { fromId: string; toId: string; amount: number };

export type SplitSummary = {
  people: PersonBalance[];
  /** The fewest payments that settle everything */
  transfers: Transfer[];
  /** Total of priced bookings nobody has said they paid for */
  unassigned: number;
  /** Total of bookings someone paid for */
  total: number;
};

/** Splits whole cents as evenly as possible; the first people take any leftover cent. */
export function splitCents(cents: number, ways: number): number[] {
  const base = Math.floor(cents / ways);
  const extra = cents - base * ways;
  return Array.from({ length: ways }, (_, i) => base + (i < extra ? 1 : 0));
}

export function summariseSplit(people: SplitPerson[], expenses: SplitExpense[], payments: SplitPayment[] = []): SplitSummary {
  const ids = new Set(people.map((p) => p.id));
  const paid = new Map(people.map((p) => [p.id, 0]));
  const share = new Map(people.map((p) => [p.id, 0]));
  const settle = new Map(people.map((p) => [p.id, 0]));
  let unassigned = 0;
  let total = 0;

  for (const e of expenses) {
    const cents = toCents(e.amount);
    if (cents <= 0) continue;
    if (!e.paidById || !ids.has(e.paidById)) {
      unassigned += cents;
      continue;
    }
    total += cents;
    paid.set(e.paidById, paid.get(e.paidById)! + cents);
    // Only people still on the trip share it; nobody left = everyone
    const sharers = people.map((p) => p.id).filter((id) => !e.splitWith.length || e.splitWith.includes(id));
    const among = sharers.length ? sharers : people.map((p) => p.id);
    splitCents(cents, among.length).forEach((c, i) => share.set(among[i], share.get(among[i])! + c));
  }

  for (const p of payments) {
    const cents = toCents(p.amount);
    if (cents <= 0 || !ids.has(p.fromId) || !ids.has(p.toId) || p.fromId === p.toId) continue;
    settle.set(p.fromId, settle.get(p.fromId)! + cents); // paying back lowers what you owe
    settle.set(p.toId, settle.get(p.toId)! - cents);
  }

  const net = new Map(people.map((p) => [p.id, paid.get(p.id)! - share.get(p.id)! + settle.get(p.id)!]));

  // Fewest payments: biggest debtor pays biggest creditor, repeat
  const transfers: Transfer[] = [];
  const debtors = people.filter((p) => net.get(p.id)! < 0).map((p) => ({ id: p.id, cents: -net.get(p.id)! }));
  const creditors = people.filter((p) => net.get(p.id)! > 0).map((p) => ({ id: p.id, cents: net.get(p.id)! }));
  const byCents = (a: { cents: number }, b: { cents: number }) => b.cents - a.cents;
  while (debtors.length && creditors.length) {
    debtors.sort(byCents);
    creditors.sort(byCents);
    const d = debtors[0];
    const c = creditors[0];
    const cents = Math.min(d.cents, c.cents);
    transfers.push({ fromId: d.id, toId: c.id, amount: fromCents(cents) });
    d.cents -= cents;
    c.cents -= cents;
    if (!d.cents) debtors.shift();
    if (!c.cents) creditors.shift();
  }

  return {
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      paid: fromCents(paid.get(p.id)!),
      share: fromCents(share.get(p.id)!),
      balance: fromCents(net.get(p.id)!),
    })),
    transfers,
    unassigned: fromCents(unassigned),
    total: fromCents(total),
  };
}
