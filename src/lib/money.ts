// Money arrives from Prisma as Decimal objects (or strings/numbers from forms).
// Do arithmetic in integer cents to avoid floating-point drift.

export type MoneyLike = number | string | { toString(): string };

export function toCents(value: MoneyLike | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Sum a list of money values exactly. */
export function sumMoney(values: Array<MoneyLike | null | undefined>): number {
  return fromCents(values.reduce<number>((acc, v) => acc + toCents(v), 0));
}

/** A price for display: "Free" for 0, otherwise the amount. */
export function formatPrice(amount: MoneyLike, currency: string) {
  return Number(amount.toString()) === 0 ? "Free" : formatMoney(amount, currency);
}

export function formatMoney(amount: MoneyLike, currency: string, opts?: { compact?: boolean }) {
  const n = Number(amount.toString());
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: opts?.compact || Number.isInteger(n) ? 0 : 2,
  }).format(n);
}
