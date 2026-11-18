import { itemPriceParts } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { BuilderItem } from "@/server/trips";

/** "¥14,000" with "≈ $95" underneath when it's priced in another currency. */
export function ItemPrice({
  item,
  tripCurrency,
  className,
}: {
  item: Pick<BuilderItem, "cost" | "currency" | "costInTripCurrency">;
  tripCurrency: string;
  className?: string;
}) {
  const parts = itemPriceParts(item.cost, item.currency, tripCurrency, item.costInTripCurrency);
  if (!parts) return null;
  return (
    <span className={cn("shrink-0 text-right tabular-nums", className)}>
      <span className="block">{parts.main}</span>
      {parts.converted ? <span className="block text-xs font-medium text-muted-foreground">{parts.converted}</span> : null}
    </span>
  );
}
