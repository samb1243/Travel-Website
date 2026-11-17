import { bookingProgress, STATUS_META, type StatusCounts } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Segmented bar in the shared status colours plus "7/10 booked". */
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
    { status: "PAY_ON_ARRIVAL" as const, n: counts.PAY_ON_ARRIVAL },
    { status: "TO_BOOK" as const, n: counts.TO_BOOK },
  ];

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          {booked}/{total} booked
        </span>
        {toBook > 0 ? (
          <span className="text-amber-700 dark:text-amber-300">{toBook} to book</span>
        ) : (
          <span className="text-emerald-700 dark:text-emerald-300">All booked</span>
        )}
      </div>
      <div
        className={cn("flex w-full gap-0.5 overflow-hidden rounded-full bg-muted", size === "lg" ? "h-3" : "h-2")}
        role="img"
        aria-label={`${counts.BOOKED} booked, ${counts.PAY_ON_ARRIVAL} pay on arrival, ${counts.TO_BOOK} still to book`}
      >
        {segments.map(({ status, n }) =>
          n > 0 ? (
            <div key={status} className={STATUS_META[status].dot} style={{ width: `${(n / total) * 100}%` }} />
          ) : null,
        )}
      </div>
    </div>
  );
}
