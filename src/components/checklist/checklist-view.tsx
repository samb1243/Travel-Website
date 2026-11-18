"use client";

import { CategoryTile } from "@/components/builder/category-tile";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlarmClockIcon, CalendarXIcon, CheckIcon, ChevronDownIcon, ClipboardListIcon, ExternalLinkIcon, PartyPopperIcon } from "lucide-react";
import { AddedBy } from "@/components/builder/item-card";
import { ItemSheet, type ItemSheetState } from "@/components/builder/item-sheet";
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
  buildChecklist,
  CHECKLIST_ORDER,
  countStatuses,
  nextStatusOnTap,
  SOON_DAYS,
  urgencyLabel,
  type ChecklistEntry,
} from "@/lib/checklist";
import { formatDate, formatItemWhen, plural } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";
import { linkButtonLabel } from "@/lib/item-categories";
import { formatPrice } from "@/lib/money";
import { ITEM_STATUSES, STATUS_META, type ItemStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { setItemStatus } from "@/server/actions/builder";
import type { BuilderItem, BuilderStop } from "@/server/trips";

const GROUP_HINT: Record<ItemStatus, string> = {
  TO_BOOK: "Still needs booking",
  PAY_ON_ARRIVAL: "Reserved, pay when you get there",
  BOOKED: "Paid and confirmed",
  NOT_NEEDED: "Walk-ins, free entry and things you already have",
};

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
  // Status changes show at once; the server's data replaces them when the action finishes.
  const [shown, applyStatus] = useOptimistic(items, (current, change: { id: string; status: ItemStatus }) =>
    current.map((i) => (i.id === change.id ? { ...i, status: change.status } : i)),
  );
  const [, startTransition] = useTransition();
  const [sheet, setSheet] = useState<ItemSheetState>(null);

  function changeStatus(item: BuilderItem, status: ItemStatus, offerUndo = true) {
    if (item.status === status) return;
    const previous = item.status;
    startTransition(async () => {
      applyStatus({ id: item.id, status });
      try {
        const result = await setItemStatus(item.id, status);
        if (!result.ok) throw new Error(result.message);
      } catch {
        toast.error(`Couldn't update "${item.title}". Check your connection and try again.`);
        return;
      }
      if (offerUndo) {
        toast.success(`${item.title}: ${STATUS_META[status].label.toLowerCase()}`, {
          id: `status-${item.id}`,
          action: { label: "Undo", onClick: () => changeStatus({ ...item, status }, previous, false) },
        });
      }
    });
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

  const { groups, dueSoon, overdue } = buildChecklist(shown, stops, today);
  const counts = countStatuses(shown);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <BookingProgress counts={counts} size="lg" />
        {dueSoon > 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            <AlarmClockIcon className="size-4 shrink-0" aria-hidden />
            {plural(dueSoon, "thing")} to book in the next {SOON_DAYS / 7} weeks
          </p>
        ) : null}
        {overdue > 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
            <CalendarXIcon className="size-4 shrink-0" aria-hidden />
            {plural(overdue, "item")} past {overdue === 1 ? "its date" : "their dates"} and still not booked
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Tap a circle to mark something booked. Tap the status to pick another one, or the name to edit it.
        </p>
      </div>

      {counts.TO_BOOK === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <PartyPopperIcon className="size-6 shrink-0" aria-hidden />
          <p className="font-medium">Everything&apos;s sorted. Nothing left to book.</p>
        </div>
      ) : null}

      {CHECKLIST_ORDER.map((status) =>
        groups[status].length ? (
          <ChecklistGroup
            key={status}
            status={status}
            entries={groups[status]}
            currency={currency}
            onToggle={(item) => changeStatus(item, nextStatusOnTap(item.status))}
            onPick={changeStatus}
            onEdit={(item) => setSheet({ mode: "edit", item })}
          />
        ) : null,
      )}

      <ItemSheet tripId={tripId} currency={currency} stops={stops} state={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

function ChecklistGroup({
  status,
  entries,
  currency,
  onToggle,
  onPick,
  onEdit,
}: {
  status: ItemStatus;
  entries: ChecklistEntry<BuilderItem>[];
  currency: string;
  onToggle: (item: BuilderItem) => void;
  onPick: (item: BuilderItem, status: ItemStatus) => void;
  onEdit: (item: BuilderItem) => void;
}) {
  const meta = STATUS_META[status];
  return (
    <details open className="group/section space-y-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-1 [&::-webkit-details-marker]:hidden">
        <span className={cn("size-3 shrink-0 rounded-full", meta.dot)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="font-heading text-lg font-extrabold">
            {meta.label}{" "}
            <span className="ml-1 inline-grid min-w-7 place-items-center rounded-md bg-muted px-1.5 align-[2px] text-sm font-bold text-muted-foreground tabular-nums">
              {entries.length}
            </span>
          </span>
          <span className="block text-sm text-muted-foreground">{GROUP_HINT[status]}</span>
        </span>
        <ChevronDownIcon
          className="size-5 shrink-0 text-muted-foreground transition-transform group-open/section:rotate-180"
          aria-hidden
        />
      </summary>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <ChecklistRow
            key={entry.item.id}
            entry={entry}
            currency={currency}
            onToggle={() => onToggle(entry.item)}
            onPick={(s) => onPick(entry.item, s)}
            onEdit={() => onEdit(entry.item)}
          />
        ))}
      </ul>
    </details>
  );
}

const URGENCY_STYLE = {
  overdue: {
    row: "bg-red-50/70 ring-1 ring-red-300 dark:bg-red-500/10 dark:ring-red-500/40",
    badge: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200",
  },
  soon: {
    row: "bg-amber-50/80 ring-1 ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-500/40",
    badge: "bg-amber-200/70 text-amber-900 dark:bg-amber-500/25 dark:text-amber-100",
  },
  upcoming: {
    row: "",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
} as const;

function ChecklistRow({
  entry,
  currency,
  onToggle,
  onPick,
  onEdit,
}: {
  entry: ChecklistEntry<BuilderItem>;
  currency: string;
  onToggle: () => void;
  onPick: (status: ItemStatus) => void;
  onEdit: () => void;
}) {
  const { item, urgency, daysUntil, stopName } = entry;
  const status = STATUS_META[item.status];
  const done = item.status !== "TO_BOOK";
  const when = formatItemWhen(item.startAt, item.endAt, item.allDay);
  const flag = urgency ? urgencyLabel(urgency, daysUntil) : null;
  const flagStyle = urgency && urgency in URGENCY_STYLE ? URGENCY_STYLE[urgency as keyof typeof URGENCY_STYLE] : null;
  const bookingLink = item.status === "TO_BOOK" ? item.links.find((l) => l.kind === "BOOKING") : undefined;

  return (
    <li className={cn("rounded-2xl border border-l-4 bg-card p-2 pr-3", status.border, flagStyle?.row)}>
      <div className="flex items-start gap-1">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Mark ${item.title} as to book` : `Mark ${item.title} as booked`}
          onClick={onToggle}
          className="grid size-11 shrink-0 place-items-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span
            className={cn(
              "grid size-7 place-items-center rounded-full border-2 transition-colors",
              done ? cn(status.dot, "border-transparent text-white") : "border-amber-500 bg-background hover:bg-amber-50 dark:hover:bg-amber-500/10",
            )}
          >
            {done ? <CheckIcon className="size-4" strokeWidth={3} aria-hidden /> : null}
          </span>
        </button>

        <div className="min-w-0 flex-1 py-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex w-full items-start justify-between gap-2 rounded-md text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex min-w-0 items-start gap-2">
              <CategoryTile category={item.category} size="sm" />
              <span className={cn("font-medium text-pretty", item.status === "NOT_NEEDED" && "text-muted-foreground")}>
                {item.title}
              </span>
            </span>
            {item.cost !== null ? (
              <span className="shrink-0 text-sm font-medium tabular-nums">{formatPrice(item.cost, currency)}</span>
            ) : null}
          </button>
          <p className="mt-0.5 pl-6 text-sm text-muted-foreground">
            {[
              stopName ?? "Whole trip",
              when ?? (entry.date ? `arrive ${formatDate(parseDateOnly(entry.date), { weekday: true })}` : "No date yet"),
            ].join(" · ")}
          </p>
          <AddedBy who={item.addedBy} className="pl-6" />

          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  status.badge,
                )}
                aria-label={`Status: ${status.label}. Change status`}
              >
                <span aria-hidden>{status.emoji}</span> {status.label}
                <ChevronDownIcon className="size-3.5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-52">
                <DropdownMenuLabel>Booking status</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={item.status} onValueChange={(v) => onPick(v as ItemStatus)}>
                  {ITEM_STATUSES.map((s) => (
                    <DropdownMenuRadioItem key={s} value={s} className="min-h-11">
                      <span className={cn("size-2.5 rounded-full", STATUS_META[s].dot)} aria-hidden />
                      {STATUS_META[s].label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {flag ? (
              <span className={cn("inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold", flagStyle?.badge)}>
                {flag}
              </span>
            ) : null}

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
