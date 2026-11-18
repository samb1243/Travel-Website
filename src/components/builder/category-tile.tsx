import { CATEGORY_META, GROUP_META, ITEM_GROUPS, itemGroup, type ItemGroup } from "@/lib/item-categories";
import type { ItemCategory } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { tile: "size-6 rounded-md", icon: "size-3.5" },
  md: { tile: "size-8 rounded-lg", icon: "size-4" },
} as const;

/** An item's category icon on a tile coloured by its group (getting around, stays, things to do, gear & admin). */
export function CategoryTile({
  category,
  size = "md",
  className,
}: {
  category: ItemCategory;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const s = SIZES[size];
  return (
    <span className={cn("grid shrink-0 place-items-center", s.tile, GROUP_META[itemGroup(category)].tile, className)}>
      <Icon className={s.icon} aria-label={meta.label} />
    </span>
  );
}

/** Key for the colours. */
export function CategoryLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground", className)} aria-label="Colour key">
      {ITEM_GROUPS.map((g) => (
        <li key={g} className="inline-flex items-center gap-1.5">
          <span className={cn("size-3 rounded-[4px]", GROUP_META[g].tile)} aria-hidden />
          {GROUP_META[g].label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The colour key as a filter: tap groups to show only those items (several at
 * once is fine), "Show all" to reset. Counts show how many items each has.
 */
export function CategoryFilter({
  selected,
  onChange,
  counts,
  className,
}: {
  selected: ItemGroup[];
  onChange: (groups: ItemGroup[]) => void;
  counts: Record<ItemGroup, number>;
  className?: string;
}) {
  const toggle = (g: ItemGroup) =>
    onChange(selected.includes(g) ? selected.filter((x) => x !== g) : ITEM_GROUPS.filter((x) => x === g || selected.includes(x)));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label="Show only">
      {ITEM_GROUPS.map((g) => {
        const on = selected.includes(g);
        const empty = counts[g] === 0;
        return (
          <button
            key={g}
            type="button"
            aria-pressed={on}
            disabled={empty && !on}
            onClick={() => toggle(g)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default disabled:opacity-40",
              on ? "border-foreground bg-foreground text-background" : "bg-card text-foreground enabled:hover:bg-accent",
            )}
          >
            <span className={cn("size-3 shrink-0 rounded-[4px]", GROUP_META[g].tile)} aria-hidden />
            {GROUP_META[g].label}
            <span className={cn("tabular-nums", on ? "text-background/70" : "text-muted-foreground")}>{counts[g]}</span>
          </button>
        );
      })}
      {selected.length ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="h-9 rounded-lg px-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Show all
        </button>
      ) : null}
    </div>
  );
}

/** Shown under a stop when the filter hides all of its items. */
export function FilteredOutNote({ groups }: { groups: ItemGroup[] }) {
  const names = groups.map((g) => GROUP_META[g].label.toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0];
  return <p className="py-1 text-sm text-muted-foreground">No {list} here.</p>;
}
