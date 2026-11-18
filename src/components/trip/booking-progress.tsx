import { bookingProgress, STATUS_META, type StatusCounts } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Segmented bar in the status colours plus "7/10 sorted" (booked or bought). */
export function BookingProgress({
  counts,
  className,
  size = "sm",
}: {
  counts: StatusCounts;
  className?: string;
  size?: "sm" | "lg";
}) {
  const { booked, total, toBook } = bookingProgress(counts);

  if (total === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Nothing to book yet</p>;
  }

  const segments = [
    { status: "BOOKED" as const, n: counts.BOOKED },
    { status: "BOUGHT" as const, n: counts.BOUGHT },
    { status: "HAVE" as const, n: counts.HAVE },
    { status: "TO_BUY" as const, n: counts.TO_BUY },
    { status: "TO_BOOK" as const, n: counts.TO_BOOK },
  ];
  const described = segments
    .filter((s) => s.n > 0)
    .map((s) => `${s.n} ${STATUS_META[s.status].label.toLowerCase()}`)
    .join(", ");

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          {booked}/{total} sorted
        </span>
        {toBook > 0 ? (
          <span className="font-medium">{toBook} to book or buy</span>
        ) : (
          <span className="font-medium">All sorted</span>
        )}
      </div>
      <div
        className={cn("flex w-full gap-0.5 overflow-hidden rounded-full bg-muted", size === "lg" ? "h-3" : "h-2")}
        role="img"
        aria-label={described}
      >
        {segments.map(({ status, n }) =>
          n > 0 ? <div key={status} className={STATUS_META[status].dot} style={{ width: `${(n / total) * 100}%` }} /> : null,
        )}
      </div>
    </div>
  );
}
