"use client";

import { CategoryTile } from "@/components/builder/category-tile";
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
import { formatMoney, formatPrice, toCents } from "@/lib/money";
import { RATES_CREDIT } from "@/lib/rates-fetch";
import { effectivePayment, isOpen, PAYMENT_META, STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { SplitCard, type SplitCardData } from "@/components/budget/split-card";
import type { BuilderItem, BuilderStop } from "@/server/trips";

const LEVEL_STYLE: Record<BudgetLevel, { bar: string; text: string }> = {
  none: { bar: "bg-primary", text: "text-muted-foreground" },
  under: { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  near: { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  over: { bar: "bg-red-500", text: "text-red-700 dark:text-red-300" },
};

const PAYMENT_HINT = {
  PAID: "Paid",
  PAY_ON_ARRIVAL: "Pay on arrival",
  TO_PAY: "Still to pay",
  UNSET: "Payment not set",
} as const;

const paymentDot = (p: keyof typeof PAYMENT_HINT) => (p === "UNSET" ? "bg-muted-foreground/40" : PAYMENT_META[p].dot);

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
  split = null,
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
  /** Trips planned together: the people and their settle-ups, for "Who paid" */
  split?: SplitCardData | null;
}) {
  const [sheet, setSheet] = useState<ItemSheetState>(null);
  const money = (n: number) => formatMoney(n, currency);
  /** Averages read better rounded: "$111", not "$111.04" */
  const whole = (n: number) => formatMoney(n, currency, { compact: true });
  // Budget maths uses every price converted into the trip's currency.
  const priced = items.map((i) => ({ ...i, originalCost: i.cost, cost: i.costInTripCurrency }));
  const s = summariseBudget(priced, stops, { budget, travellers, durationDays });
  // Prices of things not booked or bought yet may still change
  const notBookedCents = priced.filter((i) => isOpen(i.status)).reduce((sum, i) => sum + toCents(i.cost), 0);
  const anyForeign = items.some((i) => i.currency && i.currency !== currency && i.cost);
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
            <h2 id="budget-total" className="text-sm font-semibold text-muted-foreground">
              Planned spend
            </h2>
            <p className="font-heading text-3xl font-extrabold tabular-nums sm:text-4xl">{money(s.total)}</p>
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
          {anyForeign ? (
            <>
              {" "}Prices in other currencies are converted at today&apos;s rates (
              <a href={RATES_CREDIT.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {RATES_CREDIT.label}
              </a>
              ).
            </>
          ) : null}
          {s.missingCost > 0 ? ` ${plural(s.missingCost, "item")} without a price ${s.missingCost === 1 ? "isn't" : "aren't"} counted.` : ""}
        </p>
      </section>

      {split && !readOnly ? <SplitCard tripId={tripId} currency={currency} items={items} split={split} /> : null}

      {/* Paid vs still to pay */}
      {/* Booking and payment status are the planners' own business: not shown on other people's trips */}
      {s.total > 0 && !readOnly ? (
        <Card title="How much is paid" className="lg:col-span-2">
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            {s.byPayment.map(({ payment, total }) =>
              total > 0 ? <div key={payment} className={paymentDot(payment)} style={{ width: pct(total / s.total) }} /> : null,
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {s.byPayment.map(({ payment, total, count }) => (
              <div key={payment} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-2.5 shrink-0 rounded-full", paymentDot(payment))} aria-hidden />
                  {PAYMENT_HINT[payment]}
                </dt>
                <dd className="font-medium tabular-nums">
                  {money(total)} <span className="text-xs font-normal text-muted-foreground">· {count}</span>
                </dd>
              </div>
            ))}
          </dl>
          {notBookedCents > 0 ? (
            <p className="flex items-start gap-2 text-sm">
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-(--k-to-book-ink)" aria-hidden />
              {money(notBookedCents / 100)} is for things not booked or bought yet, so prices may change.
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
              return (
                <BarRow
                  key={category}
                  icon={<CategoryTile category={category} size="sm" />}
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
              return (
                <li key={item.id}>
                  <Tappable
                    onClick={readOnly ? undefined : () => setSheet({ mode: "edit", item })}
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-1 py-2"
                    interactiveClassName="hover:bg-accent/50"
                  >
                    <CategoryTile category={item.category} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.title}</span>
                      {readOnly || !item.status ? null : (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn("size-2 rounded-full", STATUS_META[item.status].dot)} aria-hidden />
                          {[STATUS_META[item.status].label, effectivePayment(item) ? PAYMENT_META[effectivePayment(item)!].label : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right font-medium tabular-nums">
                      <span className="block">{money(item.cost!)}</span>
                      {item.currency && item.currency !== currency && item.originalCost !== null ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {formatPrice(item.originalCost, item.currency)}
                        </span>
                      ) : null}
                    </span>
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
      <dd className="font-heading text-lg font-extrabold tabular-nums">{children}</dd>
    </div>
  );
}

function Card({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("space-y-3 rounded-2xl border bg-card p-4", className)}>
      <h2 className="font-heading text-lg font-extrabold">{title}</h2>
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
