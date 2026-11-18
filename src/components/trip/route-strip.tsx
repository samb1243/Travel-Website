import { cn } from "@/lib/utils";

const MAX_DOTS = 9;

/**
 * The trip's route as a little line diagram: first stop, a yellow line with a
 * dot per stop, last stop. Same language as the route on the trip page.
 */
export function RouteStrip({ names, className }: { names: string[]; className?: string }) {
  if (names.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No stops yet</p>;
  }
  const first = names[0];
  const last = names.at(-1)!;
  const dots = Math.min(names.length, MAX_DOTS);

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5 text-sm font-bold", className)}>
      <span className="sr-only">Route: {names.join(", then ")}</span>
      <span className="max-w-[40%] truncate" aria-hidden>
        {first}
      </span>
      {names.length > 1 ? (
        <>
          <span className="relative flex min-w-10 flex-1 items-center justify-between" aria-hidden>
            <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-trail" />
            {Array.from({ length: dots }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "relative size-2.5 rounded-full border-2 border-foreground",
                  i === 0 || i === dots - 1 ? "bg-foreground" : "bg-background",
                )}
              />
            ))}
          </span>
          <span className="max-w-[40%] truncate text-right" aria-hidden>
            {last}
          </span>
        </>
      ) : null}
    </div>
  );
}
