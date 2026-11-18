// One source of truth for status labels and colours, so every view
// (checklist, itinerary, item cards, progress bars) looks the same.
//
// An item has a main status, and bookings can also have a payment status:
//   bookings (flights, stays, transport, activities, food): Booked / To book /
//     No booking needed, plus optionally Paid / Pay on arrival / To pay
//   gear and other: Bought / To buy / Already have, or nothing
// Colours are CSS variables (src/lib/colors.ts), so people can change them.

import type { ItemCategory } from "@/generated/prisma/enums";
import type { ColorKey } from "@/lib/colors";

export const BOOKING_STATUSES = ["BOOKED", "TO_BOOK", "NOT_NEEDED"] as const;
export const PURCHASE_STATUSES = ["BOUGHT", "TO_BUY", "HAVE"] as const;
export const ITEM_STATUSES = [...BOOKING_STATUSES, ...PURCHASE_STATUSES] as const;
export const PAYMENT_STATUSES = ["PAID", "PAY_ON_ARRIVAL", "TO_PAY"] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Gear and "other" are bought (or already owned), not booked, and have no payment status. */
export function isPurchaseCategory(category: ItemCategory): boolean {
  return category === "GEAR" || category === "OTHER";
}

/** The statuses an item of this category can have */
export function statusesFor(category: ItemCategory): readonly ItemStatus[] {
  return isPurchaseCategory(category) ? PURCHASE_STATUSES : BOOKING_STATUSES;
}

/** Status for a new item, or after switching category */
export function defaultStatusFor(category: ItemCategory): ItemStatus | null {
  return isPurchaseCategory(category) ? null : "TO_BOOK";
}

type StatusMeta = {
  label: string;
  emoji: string;
  color: ColorKey;
  /** Chip: tinted with the colour, normal text so any custom colour stays readable */
  badge: string;
  /** Small dot or bar segment */
  dot: string;
  /** Filled with the colour, text that reads on it */
  solid: string;
  /** Left border accent for cards */
  border: string;
};

export const STATUS_META: Record<ItemStatus, StatusMeta> = {
  BOOKED: {
    label: "Booked",
    emoji: "✅",
    color: "booked",
    badge: "border-[color-mix(in_oklab,var(--k-booked)_55%,transparent)] bg-[color-mix(in_oklab,var(--k-booked)_16%,transparent)] text-foreground",
    dot: "bg-(--k-booked)",
    solid: "bg-(--k-booked) text-(--k-booked-fg)",
    border: "border-l-(--k-booked)",
  },
  TO_BOOK: {
    label: "To book",
    emoji: "⚠️",
    color: "to-book",
    badge: "border-[color-mix(in_oklab,var(--k-to-book)_55%,transparent)] bg-[color-mix(in_oklab,var(--k-to-book)_16%,transparent)] text-foreground",
    dot: "bg-(--k-to-book)",
    solid: "bg-(--k-to-book) text-(--k-to-book-fg)",
    border: "border-l-(--k-to-book)",
  },
  NOT_NEEDED: {
    label: "No booking needed",
    emoji: "➖",
    color: "not-needed",
    badge: "border-[color-mix(in_oklab,var(--k-not-needed)_55%,transparent)] bg-[color-mix(in_oklab,var(--k-not-needed)_16%,transparent)] text-foreground",
    dot: "bg-(--k-not-needed)",
    solid: "bg-(--k-not-needed) text-(--k-not-needed-fg)",
    border: "border-l-(--k-not-needed)",
  },
  BOUGHT: {
    label: "Bought",
    emoji: "🛍️",
    color: "bought",
    badge: "border-[color-mix(in_oklab,var(--k-bought)_55%,transparent)] bg-[color-mix(in_oklab,var(--k-bought)_16%,transparent)] text-foreground",
    dot: "bg-(--k-bought)",
    solid: "bg-(--k-bought) text-(--k-bought-fg)",
    border: "border-l-(--k-bought)",
  },
  TO_BUY: {
    label: "To buy",
    emoji: "🛒",
    color: "to-buy",
    badge: "border-[color-mix(in_oklab,var(--k-to-buy)_55%,transparent)] bg-[color-mix(in_oklab,var(--k-to-buy)_16%,transparent)] text-foreground",
    dot: "bg-(--k-to-buy)",
    solid: "bg-(--k-to-buy) text-(--k-to-buy-fg)",
    border: "border-l-(--k-to-buy)",
  },
  HAVE: {
    label: "Already have",
    emoji: "🎒",
    color: "have",
    badge: "border-[color-mix(in_oklab,var(--k-have)_55%,transparent)] bg-[color-mix(in_oklab,var(--k-have)_16%,transparent)] text-foreground",
    dot: "bg-(--k-have)",
    solid: "bg-(--k-have) text-(--k-have-fg)",
    border: "border-l-(--k-have)",
  },
};

export const PAYMENT_META: Record<PaymentStatus, StatusMeta> = {
  PAID: {
    label: "Paid",
    emoji: "💳",
    color: "paid",
    badge: "border-[color-mix(in_oklab,var(--k-paid)_55%,transparent)] bg-[color-mix(in_oklab,var(--k-paid)_16%,transparent)] text-foreground",
    dot: "bg-(--k-paid)",
    solid: "bg-(--k-paid) text-(--k-paid-fg)",
    border: "border-l-(--k-paid)",
  },
  PAY_ON_ARRIVAL: {
    label: "Pay on arrival",
    emoji: "💶",
    color: "pay-on-arrival",
    badge: "border-[color-mix(in_oklab,var(--k-pay-on-arrival)_55%,transparent)] bg-[color-mix(in_oklab,var(--k-pay-on-arrival)_16%,transparent)] text-foreground",
    dot: "bg-(--k-pay-on-arrival)",
    solid: "bg-(--k-pay-on-arrival) text-(--k-pay-on-arrival-fg)",
    border: "border-l-(--k-pay-on-arrival)",
  },
  TO_PAY: {
    label: "To pay",
    emoji: "⏳",
    color: "to-pay",
    badge: "border-[color-mix(in_oklab,var(--k-to-pay)_55%,transparent)] bg-[color-mix(in_oklab,var(--k-to-pay)_16%,transparent)] text-foreground",
    dot: "bg-(--k-to-pay)",
    solid: "bg-(--k-to-pay) text-(--k-to-pay-fg)",
    border: "border-l-(--k-to-pay)",
  },
};

/** Is it still something to do (book or buy)? */
export const isOpen = (status: ItemStatus | null) => status === "TO_BOOK" || status === "TO_BUY";
/** Is it sorted (booked, bought or already owned)? */
export const isSorted = (status: ItemStatus | null) => status === "BOOKED" || status === "BOUGHT" || status === "HAVE";

export type StatusCounts = Record<ItemStatus, number>;

export const emptyStatusCounts = (): StatusCounts => ({
  BOOKED: 0,
  TO_BOOK: 0,
  NOT_NEEDED: 0,
  BOUGHT: 0,
  TO_BUY: 0,
  HAVE: 0,
});

/**
 * "7/10 sorted": things that needed booking or buying, and how many are done.
 * "No booking needed" and gear without a status are left out.
 */
export function bookingProgress(counts: StatusCounts) {
  const booked = counts.BOOKED + counts.BOUGHT + counts.HAVE;
  const toBook = counts.TO_BOOK + counts.TO_BUY;
  const total = booked + toBook;
  return { booked, total, toBook, percent: total ? Math.round((booked / total) * 100) : 0 };
}

/**
 * Where the money stands for an item: its payment status, or for gear and
 * other what buying it implies. Null when nobody said.
 */
export function effectivePayment(item: { status: ItemStatus | null; payment: PaymentStatus | null }): PaymentStatus | null {
  if (item.payment) return item.payment;
  if (item.status === "BOUGHT" || item.status === "HAVE") return "PAID";
  if (item.status === "TO_BUY") return "TO_PAY";
  return null;
}
