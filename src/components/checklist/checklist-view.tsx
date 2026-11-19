"use client";

import { ItemPrice } from "@/components/builder/item-price";
import { CategoryTile } from "@/components/builder/category-tile";
import Link from "next/link";
import { useOptimistic, useState, useTransition, type MouseEvent } from "react";
import { toast } from "sonner";
import { AlarmClockIcon, CalendarXIcon, CheckIcon, ChevronDownIcon, ClipboardListIcon, ExternalLinkIcon, PartyPopperIcon } from "lucide-react";
import { AddedBy } from "@/components/builder/item-card";
import { ItemSheet, type ItemSheetState } from "@/components/builder/item-sheet";
import { AddConfirmationChip } from "@/components/builder/status-badges";
import { EmptyState } from "@/components/empty-state";
import { BookingProgress } from "@/components/trip/booking-progress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BOOKING_ORDER,
  bookingGroupOf,
  buildChecklist,
  countStatuses,
  nextPaymentOnTap,
  nextStatusOnTap,
  PAYMENT_ORDER,
  paymentGroupOf,
  SOON_DAYS,
  urgencyLabel,
  type BookingGroup,
  type ChecklistEntry,
  type ChecklistView as View,
  type PaymentGroup,
} from "@/lib/checklist";
import { formatDate, formatItemWhen, plural } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";
import { linkButtonLabel } from "@/lib/item-categories";
import {
  effectivePayment,
  isOpen,
  isPurchaseCategory,
  PAYMENT_META,
  PAYMENT_STATUSES,
  STATUS_META,
  statusesFor,
  type ItemStatus,
  type PaymentStatus,
} from "@/lib/status";
import { cn } from "@/lib/utils";
import { setItemPayment, setItemStatus } from "@/server/actions/builder";
import type { BuilderItem, BuilderStop } from "@/server/trips";

/** Heading, hint and colour for each section */
type GroupMeta = { label: string; hint: string; dot: string };

const BOOKING_GROUPS: Record<BookingGroup, GroupMeta> = {
  TO_BOOK: { label: "To book", hint: "Still needs booking", dot: STATUS_META.TO_BOOK.dot },
  TO_BUY: { label: "To buy", hint: "Gear and extras still to get", dot: STATUS_META.TO_BUY.dot },
  BOOKED: { label: "Booked", hint: "Reserved and confirmed", dot: STATUS_META.BOOKED.dot },
  BOUGHT: { label: "Bought", hint: "Got it", dot: STATUS_META.BOUGHT.dot },
  HAVE: { label: "Already have", hint: "Packed from home", dot: STATUS_META.HAVE.dot },
  NOT_NEEDED: { label: "No booking needed", hint: "Walk-ins and free entry", dot: STATUS_META.NOT_NEEDED.dot },
  NONE: { label: "No status", hint: "Gear and other items without a status", dot: "bg-muted-foreground/40" },
};

const PAYMENT_GROUPS: Record<PaymentGroup, GroupMeta> = {
  TO_PAY: { label: "To pay", hint: "Still needs paying", dot: PAYMENT_META.TO_PAY.dot },
  PAY_ON_ARRIVAL: { label: "Pay on arrival", hint: "Pay when you get there", dot: PAYMENT_META.PAY_ON_ARRIVAL.dot },
  PAID: { label: "Paid", hint: "Paid already (bought gear counts too)", dot: PAYMENT_META.PAID.dot },
  UNSET: { label: "Payment not set", hint: "Has a price, but no payment status yet", dot: "bg-muted-foreground/40" },
};

type Change = { id: string; status?: ItemStatus | null; payment?: PaymentStatus | null };

export function ChecklistView({
  tripId,
  currency,
  today,
  items,
  stops,
}: {
  tripId: string;
  currency: string;
  /** "YYYY-MM-DD", from the server so server and browser agree */
  today: string;
  items: BuilderItem[];
  stops: Pick<BuilderStop, "id" | "name" | "arriveOn">[];
}) {
  // Changes show at once; the server's data replaces them when the action finishes.
  const [shown, applyChange] = useOptimistic(items, (current, change: Change) =>
    current.map((i) => (i.id === change.id ? { ...i, ...change } : i)),
  );
  const [, startTransition] = useTransition();
  const [sheet, setSheet] = useState<ItemSheetState>(null);
  const [view, setView] = useState<View>("booking");

  function changeStatus(item: BuilderItem, status: ItemStatus, offerUndo = true) {
    if (item.status === status) return;
    const previous = item.status;
    startTransition(async () => {
      applyChange({ id: item.id, status });
      try {
        const result = await setItemStatus(item.id, status);
        if (!result.ok) throw new Error(result.message);
      } catch {
        toast.error(`Couldn't update "${item.title}". Check your connection and try again.`);
        return;
      }
      if (offerUndo && previous) {
        toast.success(`${item.title}: ${STATUS_META[status].label.toLowerCase()}`, {
          id: `status-${item.id}`,
          action: { label: "Undo", onClick: () => changeStatus({ ...item, status }, previous, false) },
        });
      }
    });
  }

  function changePayment(item: BuilderItem, payment: PaymentStatus | null, offerUndo = true) {
    if (item.payment === payment) return;
    const previous = item.payment;
    startTransition(async () => {
      applyChange({ id: item.id, payment });
      try {
        const result = await setItemPayment(item.id, payment);
        if (!result.ok) throw new Error(result.message);
      } catch {
        toast.error(`Couldn't update "${item.title}". Check your connection and try again.`);
        return;
      }
      if (offerUndo) {
        toast.success(`${item.title}: ${payment ? PAYMENT_META[payment].label.toLowerCase() : "payment cleared"}`, {
          id: `payment-${item.id}`,
          action: { label: "Undo", onClick: () => changePayment({ ...item, payment }, previous, false) },
        });
      }
    });
  }

  /** The circle: book/buy it, or in the payment view, pay for it */
  function toggle(item: BuilderItem) {
    const purchase = isPurchaseCategory(item.category);
    if (view === "payment") {
      // Gear's payment follows from buying it
      if (purchase) changeStatus(item, item.status === "BOUGHT" || item.status === "HAVE" ? "TO_BUY" : "BOUGHT");
      else changePayment(item, nextPaymentOnTap(item.payment));
    } else {
      changeStatus(item, nextStatusOnTap(item.status, purchase));
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ClipboardListIcon}
        title="Nothing to check off yet"
        action={
          <Button asChild size="lg">
            <Link href={`/trips/${tripId}`}>Add bookings on the Overview</Link>
          </Button>
        }
      >
        Add flights, stays and activities to your stops and they&apos;ll show up here, grouped by whether they&apos;re booked.
      </EmptyState>
    );
  }

  const counts = countStatuses(shown);
  const booking = buildChecklist(shown, stops, today, BOOKING_ORDER, bookingGroupOf);
  const paying = buildChecklist(shown, stops, today, PAYMENT_ORDER, paymentGroupOf);
  const { dueSoon, overdue } = booking;
  const sections =
    view === "booking"
      ? BOOKING_ORDER.map((k) => ({ key: k, meta: BOOKING_GROUPS[k], entries: booking.groups[k] }))
      : PAYMENT_ORDER.map((k) => ({ key: k, meta: PAYMENT_GROUPS[k], entries: paying.groups[k] }));
  const leftToPay = paying.groups.TO_PAY.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <BookingProgress counts={counts} size="lg" />
        {dueSoon > 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlarmClockIcon className="size-4 shrink-0 text-(--k-to-book-ink)" aria-hidden />
            {plural(dueSoon, "thing")} to book or buy in the next {SOON_DAYS / 7} weeks
          </p>
        ) : null}
        {overdue > 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
            <CalendarXIcon className="size-4 shrink-0" aria-hidden />
            {plural(overdue, "item")} past {overdue === 1 ? "its date" : "their dates"} and still not sorted
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {view === "booking"
            ? "Tap a circle to mark something booked or bought. Tap a status to pick another, or anywhere else on a card to edit it."
            : "Tap a circle to mark something paid. Tap a status to pick another, or anywhere else on a card to edit it."}
        </p>
      </div>

      {/* Two ways to look at it: booking & buying, or payment */}
      <div role="tablist" aria-label="Checklist view" className="grid grid-cols-2 gap-1 rounded-2xl border bg-card p-1">
        {(
          [
            ["booking", "Booking & buying"],
            ["payment", "Payment"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {label}
            {v === "payment" && leftToPay > 0 ? <span className="ml-1.5 tabular-nums">· {leftToPay} to pay</span> : null}
          </button>
        ))}
      </div>

      {view === "booking" && counts.TO_BOOK + counts.TO_BUY === 0 ? (
        <Celebrate>Everything&apos;s sorted. Nothing left to book or buy.</Celebrate>
      ) : null}
      {view === "payment" && leftToPay === 0 && paying.groups.UNSET.length === 0 ? (
        <Celebrate>Nothing left to pay before you go.</Celebrate>
      ) : null}

      {sections.map(({ key, meta, entries }) =>
        entries.length ? (
          <ChecklistGroup key={`${view}-${key}`} meta={meta} count={entries.length}>
            {entries.map((entry) => (
              <ChecklistRow
                key={entry.item.id}
                entry={entry}
                view={view}
                currency={currency}
                onToggle={() => toggle(entry.item)}
                onPickStatus={(s) => changeStatus(entry.item, s)}
                onPickPayment={(p) => changePayment(entry.item, p)}
                onEdit={() => setSheet({ mode: "edit", item: entry.item })}
              />
            ))}
          </ChecklistGroup>
        ) : null,
      )}

      <ItemSheet tripId={tripId} currency={currency} stops={stops} state={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

function Celebrate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--k-booked)_45%,transparent)] bg-[color-mix(in_oklab,var(--k-booked)_12%,transparent)] p-4">
      <PartyPopperIcon className="size-6 shrink-0 text-(--k-booked-ink)" aria-hidden />
      <p className="font-medium">{children}</p>
    </div>
  );
}

function ChecklistGroup({ meta, count, children }: { meta: GroupMeta; count: number; children: React.ReactNode }) {
  return (
    <details open className="group/section space-y-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-1 [&::-webkit-details-marker]:hidden">
        <span className={cn("size-3 shrink-0 rounded-full", meta.dot)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="font-heading text-lg font-extrabold">
            {meta.label}{" "}
            <span className="ml-1 inline-grid min-w-7 place-items-center rounded-md bg-muted px-1.5 align-[2px] text-sm font-bold text-muted-foreground tabular-nums">
              {count}
            </span>
          </span>
          <span className="block text-sm text-muted-foreground">{meta.hint}</span>
        </span>
        <ChevronDownIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-open/section:rotate-180" aria-hidden />
      </summary>
      <ul className="space-y-2">{children}</ul>
    </details>
  );
}

const URGENCY_STYLE = {
  overdue: {
    row: "bg-red-50/70 ring-1 ring-red-300 dark:bg-red-500/10 dark:ring-red-500/40",
    badge: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200",
  },
  soon: {
    row: "bg-[color-mix(in_oklab,var(--k-to-book)_10%,var(--card))] ring-1 ring-[color-mix(in_oklab,var(--k-to-book)_55%,transparent)]",
    badge: "bg-[color-mix(in_oklab,var(--k-to-book)_30%,transparent)] text-foreground",
  },
  upcoming: {
    row: "",
    badge: "bg-[color-mix(in_oklab,var(--k-to-book)_16%,transparent)] text-foreground",
  },
} as const;

/** Clicks on these don't open the edit form (they do their own thing) */
const OWN_ACTION = "button, a, input, [role^='menuitem'], [role='menu']";

function ChecklistRow({
  entry,
  view,
  currency,
  onToggle,
  onPickStatus,
  onPickPayment,
  onEdit,
}: {
  entry: ChecklistEntry<BuilderItem>;
  view: View;
  currency: string;
  onToggle: () => void;
  onPickStatus: (status: ItemStatus) => void;
  onPickPayment: (payment: PaymentStatus | null) => void;
  onEdit: () => void;
}) {
  const { item, urgency, daysUntil, stopName } = entry;
  const purchase = isPurchaseCategory(item.category);
  const status = item.status ? STATUS_META[item.status] : null;
  const pay = effectivePayment(item);
  const done = view === "payment" ? pay === "PAID" : !isOpen(item.status) && item.status !== null;
  const accent = view === "payment" ? (pay ? PAYMENT_META[pay].border : "border-l-muted") : (status?.border ?? "border-l-muted");
  const when = formatItemWhen(item.startAt, item.endAt, item.allDay);
  const flag = view === "booking" && urgency ? urgencyLabel(urgency, daysUntil, purchase ? "Buy" : "Book") : null;
  const flagStyle = view === "booking" && urgency && urgency in URGENCY_STYLE ? URGENCY_STYLE[urgency as keyof typeof URGENCY_STYLE] : null;
  const bookingLink = isOpen(item.status) ? item.links.find((l) => l.kind === "BOOKING") : undefined;
  const circleLabel =
    view === "payment"
      ? done
        ? `Mark ${item.title} as not paid`
        : `Mark ${item.title} as paid`
      : done
        ? `Mark ${item.title} as ${purchase ? "to buy" : "to book"}`
        : `Mark ${item.title} as ${purchase ? "bought" : "booked"}`;

  // The whole card opens the edit form, except its own buttons, links and menus
  function onCardClick(e: MouseEvent<HTMLLIElement>) {
    if ((e.target as HTMLElement).closest(OWN_ACTION)) return;
    onEdit();
  }

  return (
    <li
      onClick={onCardClick}
      className={cn(
        "cursor-pointer rounded-2xl border border-l-4 bg-card p-2 pr-3 transition-colors hover:bg-accent/40",
        accent,
        flagStyle?.row,
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={circleLabel}
          onClick={onToggle}
          className="grid size-11 shrink-0 place-items-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span
            className={cn(
              "grid size-7 place-items-center rounded-full border-2 transition-colors",
              done
                ? cn(view === "payment" ? PAYMENT_META.PAID.solid : (status?.solid ?? ""), "border-transparent")
                : "border-foreground/35 bg-background hover:bg-accent",
            )}
          >
            {done ? <CheckIcon className="size-4" strokeWidth={3} aria-hidden /> : null}
          </span>
        </button>

        <div className="min-w-0 flex-1 py-1">
          {/* A real button too, so the edit form is reachable by keyboard */}
          <button
            type="button"
            onClick={onEdit}
            className="flex w-full items-start justify-between gap-2 rounded-md text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex min-w-0 items-start gap-2">
              <CategoryTile category={item.category} size="sm" />
              <span className={cn("font-medium text-pretty", item.status === "NOT_NEEDED" && "text-muted-foreground")}>{item.title}</span>
            </span>
            <ItemPrice item={item} tripCurrency={currency} className="text-sm font-medium" />
          </button>
          <p className="mt-0.5 pl-6 text-sm text-muted-foreground">
            {[
              stopName ?? "Whole trip",
              when ?? (entry.date ? `arrive ${formatDate(parseDateOnly(entry.date), { weekday: true })}` : "No date yet"),
              item.provider,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {item.address ? <p className="pl-6 text-sm text-muted-foreground">{item.address}</p> : null}
          {item.notes ? <p className="pl-6 text-sm text-pretty whitespace-pre-line">{item.notes}</p> : null}
          <AddedBy who={item.addedBy} className="pl-6" />

          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
            <StatusMenu
              label={status ? status.label : "No status"}
              emoji={status?.emoji}
              badge={status?.badge ?? "border-dashed bg-background"}
              title={purchase ? "Status" : "Booking"}
              value={item.status ?? ""}
              options={statusesFor(item.category).map((s) => ({ value: s, label: STATUS_META[s].label, dot: STATUS_META[s].dot }))}
              onPick={(v) => onPickStatus(v as ItemStatus)}
            />
            {purchase ? null : (
              <StatusMenu
                label={item.payment ? PAYMENT_META[item.payment].label : "Payment not set"}
                emoji={item.payment ? PAYMENT_META[item.payment].emoji : undefined}
                badge={item.payment ? PAYMENT_META[item.payment].badge : "border-dashed bg-background text-muted-foreground"}
                title="Payment"
                value={item.payment ?? ""}
                options={[
                  ...PAYMENT_STATUSES.map((p) => ({ value: p, label: PAYMENT_META[p].label, dot: PAYMENT_META[p].dot })),
                  { value: "", label: "Not set", dot: "bg-muted-foreground/40" },
                ]}
                onPick={(v) => onPickPayment((v || null) as PaymentStatus | null)}
              />
            )}

            {flag ? (
              <span className={cn("inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold", flagStyle?.badge)}>{flag}</span>
            ) : null}

            {item.needsOwnConfirmation ? <AddConfirmationChip onClick={onEdit} className="h-9 px-3" /> : null}

            {bookingLink ? (
              <a
                href={bookingLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-3 text-sm font-medium hover:bg-accent"
              >
                <ExternalLinkIcon className="size-3.5 text-muted-foreground" aria-hidden />
                {linkButtonLabel(bookingLink)}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function StatusMenu({
  label,
  emoji,
  badge,
  title,
  value,
  options,
  onPick,
}: {
  label: string;
  emoji?: string;
  badge: string;
  title: string;
  value: string;
  options: { value: string; label: string; dot: string }[];
  onPick: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          badge,
        )}
        aria-label={`${title}: ${label}. Change it`}
      >
        {emoji ? <span aria-hidden>{emoji}</span> : null} {label}
        <ChevronDownIcon className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={onPick}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value || "none"} value={o.value} className="min-h-11">
              <span className={cn("size-2.5 rounded-full", o.dot)} aria-hidden />
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
