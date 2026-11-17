// One source of truth for booking-status labels and colours, so every view
// (checklist, itinerary, item cards, progress bars) looks the same.

export const ITEM_STATUSES = ["BOOKED", "PAY_ON_ARRIVAL", "TO_BOOK", "NOT_NEEDED"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

type StatusMeta = {
  label: string;
  emoji: string;
  /** Badge / chip styling */
  badge: string;
  /** Solid dot or bar segment */
  dot: string;
  /** Left border accent for cards */
  border: string;
};

export const STATUS_META: Record<ItemStatus, StatusMeta> = {
  BOOKED: {
    label: "Booked",
    emoji: "✅",
    badge:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    dot: "bg-emerald-500",
    border: "border-l-emerald-500",
  },
  PAY_ON_ARRIVAL: {
    label: "Pay on arrival",
    emoji: "💶",
    badge:
      "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
    dot: "bg-sky-500",
    border: "border-l-sky-500",
  },
  TO_BOOK: {
    label: "To book",
    emoji: "⚠️",
    badge:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    dot: "bg-amber-500",
    border: "border-l-amber-500",
  },
  NOT_NEEDED: {
    label: "No booking needed",
    emoji: "➖",
    badge:
      "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/30",
    dot: "bg-zinc-400",
    border: "border-l-zinc-400",
  },
};

export type StatusCounts = Record<ItemStatus, number>;

export const emptyStatusCounts = (): StatusCounts => ({
  BOOKED: 0,
  PAY_ON_ARRIVAL: 0,
  TO_BOOK: 0,
  NOT_NEEDED: 0,
});

/**
 * "7/10 booked": items that need a booking are BOOKED + PAY_ON_ARRIVAL + TO_BOOK.
 * Pay-on-arrival counts as booked (it's reserved, you just pay later).
 * "No booking needed" items are left out of the count entirely.
 */
export function bookingProgress(counts: StatusCounts) {
  const booked = counts.BOOKED + counts.PAY_ON_ARRIVAL;
  const total = booked + counts.TO_BOOK;
  return { booked, total, toBook: counts.TO_BOOK, percent: total ? Math.round((booked / total) * 100) : 0 };
}
