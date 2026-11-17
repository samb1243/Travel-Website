import type { TripType } from "@/generated/prisma/enums";
import { TRIP_TYPE_META } from "@/lib/trip-types";
import { cn } from "@/lib/utils";

/**
 * The trip's photo, or a golden-hour gradient for its trip type.
 * Fills its parent: give the parent a size or aspect ratio.
 */
export function TripCover({
  type,
  coverImageUrl,
  className,
  priority = false,
}: {
  type: TripType;
  coverImageUrl: string | null;
  className?: string;
  priority?: boolean;
}) {
  const meta = TRIP_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br", meta.cover, className)}>
      {coverImageUrl ? (
        // Plain <img>: covers are arbitrary https URLs the user pastes.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImageUrl}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <>
          {/* Soft sun and horizon so the gradient feels like a sky */}
          <div className="absolute top-[38%] left-[58%] size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff2cf]/70 blur-xl" />
          <Icon className="absolute right-4 bottom-4 size-10 text-white/50" strokeWidth={1.5} aria-hidden />
        </>
      )}
    </div>
  );
}
