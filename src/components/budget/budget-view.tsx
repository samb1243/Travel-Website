"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleAlertIcon, PencilIcon, ReceiptTextIcon, WalletIcon } from "lucide-react";
import { ItemSheet, type ItemSheetState } from "@/components/builder/item-sheet";
import { EmptyState } from "@/components/empty-state";
import { Tappable } from "@/components/tappable";
import { Button } from "@/components/ui/button";
import { summariseBudget, type BudgetLevel } from "@/lib/budget";
import { plural } from "@/lib/format";
import { CATEGORY_META } from "@/lib/item-categories";
import { formatMoney } from "@/lib/money";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { BuilderItem, BuilderStop } from "@/server/trips";

const LEVEL_STYLE: Record<BudgetLevel, { bar: string; text: string }> = {
  none: { bar: "bg-primary", text: "text-muted-foreground" },
  under: { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  near: { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  over: { bar: "bg-red-500", text: "text-red-700 dark:text-red-300" },
};

const STATUS_HINT = {
  BOOKED: "Booked",
  PAY_ON_ARRIVAL: "Pay there",
  TO_BOOK: "Not booked yet",
  NOT_NEEDED: "No booking needed",
} as const;

const pct = (share: number) => `${Math.round(share * 100)}%`;

export function BudgetView({
  tripId,
  currency,
  budget,
  travellers,
  durationDays,
  items,
  stops,
  readOnly = false,
}: {
  tripId: string;
  currency: string;
  budget: number | null;
  travellers: number;
  durationDays: number | null;
  items: BuilderItem[];
  stops: BuilderStop[];
  /** Shared view: no editing */
  readOnly?: boolean;
}) {
  const [sheet, setSheet] = useState<ItemSheetState>(null);
  const money = (n: number) => formatMoney(n, currency);
  /** Averages read better rounded: "$111", not "$111.04" */
  const whole = (n: number) => formatMoney(n, currency, { compact: true });
  const s = summariseBudget(items, stops, { budget, travellers, durationDays });
  const level = LEVEL_STYLE[s.level];

  if (items.length === 0 && budget === null && readOnly) {
    return (
      <EmptyState icon={WalletIcon} title="No costs yet">
        This trip doesn&apos;t have any prices yet.
      </EmptyState>
    );
  }

  if (items.length === 0 && budget === null) {
    return (
      <EmptyState
        icon={WalletIcon}
        title="No costs yet"
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href={`/trips/${tripId}`}>Add bookings with costs</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/trips/${tripId}/edit`}>Set a budget</Link>
            </Button>
          </div>
        }
      >
        Add flights, stays and activities with their prices and you&apos;ll see where the money goes, per person and per day.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* Total vs budget */}
      <section className="space-y-3 rounded-2xl border bg-card p-4 lg:col-span-2" aria-labelledby="budget-total">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="budget-total" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Planned spend
            </h2>
            <p className="font-heading text-3xl font-semibold tabular-nums sm:text-4xl">{money(s.total)}</p>
          </div>
          {readOnly ? null : (
            <Button asChild variant="outline" size="sm" className="h-9 shrink-0">
              <Link href={`/trips/${tripId}/edit`}>
                <PencilIcon aria-hidden /> {budget === null ? "Set budget" : "Edit budget"}
              </Link>
            </Button>
          )}
        </div>

        {s.budget !== null && s.usedShare !== null ? (
          <>
            <div
              className="h-3 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={s.budget}
              aria-valuenow={Math.min(s.total, s.budget)}
              aria-label={`${pct(s.usedShare)} of the budget`}
            >
              <div className={cn("h-full rounded-full transition-[width]", level.bar)} style={{ width: pct(Math.min(1, s.usedShare)) }} />
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="text-muted-foreground">
                {pct(s.usedShare)} of {money(s.budget)} budget
              </span>
              <span className={cn("font-medium", level.text)}>
                {s.remaining! < 0 ? `${money(-s.remaining!)} over budget` : `${money(s.remaining!)} left`}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {readOnly ? "No budget set." : "No budget set. Add one to see how much you have left."}
          </p>
        )}

        <dl className="grid grid-cols-3 gap-2 border-t pt-3">
          <Stat label={travellers > 1 ? `Per person (${travellers})` : "Per person"}>{s.perPerson !== null ? whole(s.perPerson) : "—"}</Stat>
          <Stat label={durationDays ? `Per day (${durationDays})` : "Per day"}>{s.perDay !== null ? whole(s.perDay) : "Add dates"}</Stat>
          <Stat label="Per person per day">{s.perPersonPerDay !== null ? whole(s.perPersonPerDay) : "—"}</Stat>
        </dl>
        <p className="text-xs text-muted-foreground">
          Costs are totals for everyone on the trip, in {currency}.
          {s.missingCost > 0 ? ` ${plural(s.missingCost, "item")} without a price ${s.missingCost === 1 ? "isn't" : "aren't"} counted.` : ""}
        </p>
      </section>

      {/* Booked vs still to pay */}
      {s.total > 0 ? (
        <Card title="How much is sorted" className="lg:col-span-2">
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            {s.byStatus.map(({ status, total }) =>
              total > 0 ? <div key={status} className={STATUS_META[status].dot} style={{ width: pct(total / s.total) }} /> : null,
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {s.byStatus.map(({ status, total, count }) => (
              <div key={status} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-2.5 shrink-0 rounded-full", STATUS_META[status].dot)} aria-hidden />
                  {STATUS_HINT[status]}
                </dt>
                <dd className="font-medium tabular-nums">
                  {money(total)} <span className="text-xs font-normal text-muted-foreground">· {count}</span>
                </dd>
              </div>
            ))}
          </dl>
          {s.byStatus[2].total > 0 ? (
            <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {money(s.byStatus[2].total)} is for things not booked yet, so prices may change.
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* By category */}
      {s.byCategory.length ? (
        <Card title="By category">
          <ul className="space-y-3">
            {s.byCategory.map(({ category, total, count, share }) => {
              const meta = CATEGORY_META[category];
              const Icon = meta.icon;
              return (
                <BarRow
                  key={category}
                  icon={<Icon className="size-4 text-muted-foreground" aria-hidden />}
                  label={meta.label}
                  detail={plural(count, "item")}
                  amount={money(total)}
                  share={share}
                />
              );
            })}
          </ul>
        </Card>
      ) : null}

      {/* By stop */}
      {s.byStop.length ? (
        <Card title="By stop">
          <ul className="space-y-3">
            {s.byStop.map((row, i) => (
              <BarRow
                key={row.stopId ?? "trip"}
                icon={
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-xs font-bold",
                      row.stopId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {row.stopId ? i + 1 : "•"}
                  </span>
                }
                label={row.name ?? "Whole trip"}
                detail={
                  row.stopId === null
                    ? "Not tied to a stop"
                    : row.total === 0
                      ? "Nothing priced yet"
                      : [
                          row.nights !== null ? plural(row.nights, "night") : null,
                          row.stayPerNight !== null ? `stay ${whole(row.stayPerNight)}/night` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || null
                }
                amount={money(row.total)}
                share={row.share}
              />
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Biggest costs */}
      {s.biggest.length ? (
        <Card title="Biggest costs" className="lg:col-span-2">
          <ol className="divide-y">
            {s.biggest.map((item) => {
              const Icon = CATEGORY_META[item.category].icon;
              return (
                <li key={item.id}>
                  <Tappable
                    onClick={readOnly ? undefined : () => setSheet({ mode: "edit", item })}
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-1 py-2"
                    interactiveClassName="hover:bg-accent/50"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.title}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("size-2 rounded-full", STATUS_META[item.status].dot)} aria-hidden />
                        {STATUS_META[item.status].label}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{money(item.cost!)}</span>
                  </Tappable>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : (
        <div className="lg:col-span-2">
          <EmptyState icon={ReceiptTextIcon} title="Nothing priced yet">
            {readOnly ? "None of the bookings have a price yet." : "Tap any booking on the Overview and add its cost to see the breakdown."}
          </EmptyState>
        </div>
      )}

      {readOnly ? null : (
        <ItemSheet tripId={tripId} currency={currency} stops={stops} state={sheet} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function Card({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("space-y-3 rounded-2xl border bg-card p-4", className)}>
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function BarRow({
  icon,
  label,
  detail,
  amount,
  share,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string | null;
  amount: string;
  share: number;
}) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-center gap-2.5">
        <span className="grid w-6 shrink-0 place-items-center">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{label}</span>
          {detail ? <span className="block truncate text-xs text-muted-foreground">{detail}</span> : null}
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-medium tabular-nums">{amount}</span>
          <span className="block text-xs text-muted-foreground tabular-nums">{pct(share)}</span>
        </span>
      </div>
      <div className="ml-8.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary/80" style={{ width: pct(share) }} />
      </div>
    </li>
  );
}
