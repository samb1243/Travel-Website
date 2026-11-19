"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRightIcon, CheckIcon, HandCoinsIcon, Loader2Icon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { summariseSplit, type SplitPerson } from "@/lib/split";
import { cn } from "@/lib/utils";
import { deleteSettlement, recordSettlement } from "@/server/actions/split";
import type { SettlementRow } from "@/server/split";
import type { BuilderItem } from "@/server/trips";

export type SplitCardData = { people: SplitPerson[]; settlements: SettlementRow[]; viewerId: string };

/**
 * "Who paid": on trips planned together, each person's balance, the fewest
 * payments that settle up, and the payments already made.
 */
export function SplitCard({
  tripId,
  currency,
  items,
  split,
}: {
  tripId: string;
  currency: string;
  items: BuilderItem[];
  split: SplitCardData;
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const money = (n: number) => formatMoney(n, currency);
  const nameOf = (id: string) => (id === split.viewerId ? "You" : (split.people.find((p) => p.id === id)?.name ?? "Someone who left"));

  const s = summariseSplit(
    split.people,
    items.map((i) => ({ amount: i.costInTripCurrency ?? 0, paidById: i.paidById, splitWith: i.splitWith })),
    split.settlements.map(({ fromId, toId, amount }) => ({ fromId, toId, amount })),
  );

  function settle(key: string, fromId: string, toId: string, amount: number) {
    setBusy(key);
    start(async () => {
      const r = await recordSettlement(tripId, { fromId, toId, amount });
      setBusy(null);
      if (!r.ok) toast.error(r.message);
      else toast.success(`${nameOf(fromId)} paid ${nameOf(toId) === "You" ? "you" : nameOf(toId)} ${money(amount)}`);
    });
  }

  function undo(id: string) {
    setBusy(id);
    start(async () => {
      const r = await deleteSettlement(id);
      setBusy(null);
      if (!r.ok) toast.error(r.message);
    });
  }

  const nobodyPaidYet = s.total === 0;

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5 lg:col-span-2" aria-labelledby="who-paid">
      <div className="flex items-start gap-3">
        <HandCoinsIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h2 id="who-paid" className="font-heading text-lg font-extrabold">
            Who paid
          </h2>
          <p className="text-sm text-muted-foreground">
            {nobodyPaidYet
              ? "Set “Who paid” on bookings to split the costs between you."
              : `${money(s.total)} paid so far, split between ${split.people.length} people.`}
          </p>
        </div>
      </div>

      {!nobodyPaidYet ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {s.people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{nameOf(p.id)}</span>
                <span className="block text-xs text-muted-foreground">
                  Paid {money(p.paid)} · share {money(p.share)}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-right text-sm font-bold tabular-nums",
                  p.balance > 0 ? "text-(--k-paid-ink)" : p.balance < 0 ? "text-(--k-to-pay-ink)" : "text-muted-foreground",
                )}
              >
                {p.balance > 0 ? `gets back ${money(p.balance)}` : p.balance < 0 ? `owes ${money(-p.balance)}` : "all square"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {s.transfers.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">To settle up</h3>
          <ul className="space-y-2">
            {s.transfers.map((t) => {
              const key = `${t.fromId}>${t.toId}`;
              return (
                <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-background px-3 py-2.5">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                    <span className="font-semibold">{nameOf(t.fromId)}</span>
                    <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-label="pays" />
                    <span className="font-semibold">{nameOf(t.toId)}</span>
                    <span className="ml-auto font-bold tabular-nums">{money(t.amount)}</span>
                  </span>
                  <Button type="button" variant="outline" className="h-10" disabled={pending} onClick={() => settle(key, t.fromId, t.toId, t.amount)}>
                    {busy === key ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
                    Mark as paid
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : !nobodyPaidYet ? (
        <p className="flex items-center gap-2 text-sm font-medium">
          <CheckIcon className="size-4 text-(--k-paid-ink)" aria-hidden /> Everyone&apos;s square.
        </p>
      ) : null}

      {s.unassigned > 0 ? (
        <p className="text-sm text-muted-foreground">
          {money(s.unassigned)} of bookings don&apos;t say who paid, so they aren&apos;t split yet.
        </p>
      ) : null}

      {split.settlements.length ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
            Payments made ({split.settlements.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {split.settlements.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  {nameOf(p.fromId)} paid {nameOf(p.toId) === "You" ? "you" : nameOf(p.toId)}{" "}
                  <span className="font-semibold tabular-nums">{money(p.amount)}</span>
                  <span className="text-muted-foreground"> · {formatDate(new Date(p.createdAt))}</span>
                </span>
                <Button type="button" variant="ghost" size="sm" className="h-9" disabled={pending} onClick={() => undo(p.id)}>
                  {busy === p.id ? <Loader2Icon className="animate-spin" aria-hidden /> : <Undo2Icon aria-hidden />} Undo
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
