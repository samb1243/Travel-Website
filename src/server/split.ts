import "server-only";
import { db } from "@/lib/db";
import { convertAmount } from "@/lib/convert";
import type { SplitPayment, SplitPerson } from "@/lib/split";
import { getRates } from "@/server/rates";

// Read side of splitting costs: the people on a trip and the settle-ups
// recorded between them. Only for the trip's planners (callers check).

export type SettlementRow = {
  id: string;
  fromId: string;
  toId: string;
  /** In the trip's currency now (converted if the trip's currency changed since) */
  amount: number;
  createdAt: string;
};

export type TripSplitData = { people: SplitPerson[]; settlements: SettlementRow[]; payments: SplitPayment[] };

/** Owner first, then members; plus anyone who has left but still appears in a settle-up. */
export async function getTripSplit(tripId: string): Promise<TripSplitData> {
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: {
      currency: true,
      owner: { select: { id: true, name: true } },
      members: { orderBy: { createdAt: "asc" }, select: { user: { select: { id: true, name: true } } } },
      settlements: {
        orderBy: { createdAt: "desc" },
        select: { id: true, fromId: true, toId: true, amount: true, currency: true, createdAt: true },
      },
    },
  });
  const people: SplitPerson[] = [trip.owner, ...trip.members.map((m) => m.user)];

  const needRates = trip.settlements.some((s) => s.currency !== trip.currency);
  const rates = needRates ? (await getRates()).table : null;
  const settlements: SettlementRow[] = trip.settlements.map((s) => ({
    id: s.id,
    fromId: s.fromId,
    toId: s.toId,
    amount: s.currency === trip.currency || !rates ? Number(s.amount) : (convertAmount(s.amount, s.currency, trip.currency, rates) ?? Number(s.amount)),
    createdAt: s.createdAt.toISOString(),
  }));
  return { people, settlements, payments: settlements.map(({ fromId, toId, amount }) => ({ fromId, toId, amount })) };
}
