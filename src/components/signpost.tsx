import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Board = {
  /** Trip title */
  title: string;
  /** How long the trip is */
  length: string;
};

/** The example trips' titles and lengths. Decorative: the boards don't link anywhere. */
const BOARDS: Board[] = [
  { title: "Three weeks in Thailand, Laos & Vietnam", length: "22 days" },
  { title: "Two weeks by train: Amsterdam to Budapest", length: "14 days" },
  { title: "Tour du Mont Blanc: 8 stages, 3 countries", length: "11 days" },
];

/**
 * A yellow trail signpost whose boards are trips. Boards alternate right and
 * left, and swing into place once when the page loads (skipped with reduced
 * motion). Hidden from screen readers: the headline beside it says what
 * Tripster is.
 */
export function Signpost({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-md pt-4 pb-16", className)} aria-hidden>
      {/* the pole */}
      <div className="absolute top-0 bottom-0 left-1/2 w-3 -translate-x-1/2 rounded-t-sm bg-[#1c3a32] dark:bg-[#cfdad5]" />
      <ul className="relative space-y-3">
        {BOARDS.map((b, i) => {
          const right = i % 2 === 0;
          return (
            <li
              key={b.title}
              className={cn("signpost-board w-[64%]", right ? "ml-[36%]" : "ml-0")}
              style={
                {
                  animationDelay: `${150 + i * 110}ms`,
                  "--swing-origin": right ? "left center" : "right center",
                  "--swing-from": right ? "-7deg" : "7deg",
                  "--swing-x": right ? "-10px" : "10px",
                } as CSSProperties
              }
            >
              <div
                className={cn(
                  "flex min-h-16 flex-col justify-center gap-0.5 bg-trail py-2.5 text-trail-foreground md:min-h-[4.5rem]",
                  right ? "signpost pr-8 pl-4" : "signpost-left pr-4 pl-8 text-right",
                )}
              >
                <span className="line-clamp-3 text-[0.9375rem] leading-tight font-extrabold text-balance md:line-clamp-2 md:text-lg">
                  {b.title}
                </span>
                <span className="text-sm leading-tight font-semibold">{b.length}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
