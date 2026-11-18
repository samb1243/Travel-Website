import type { TripType } from "@/generated/prisma/enums";
import { primaryTripType, TRIP_TYPE_META } from "@/lib/trip-types";
import { cn } from "@/lib/utils";

/**
 * The trip's photo, or a flat landscape colour with contour lines for its type.
 * Fills its parent: give the parent a size or aspect ratio.
 */
export function TripCover({
  types,
  coverImageUrl,
  className,
  priority = false,
}: {
  types: TripType[];
  coverImageUrl: string | null;
  className?: string;
  priority?: boolean;
}) {
  const meta = TRIP_TYPE_META[primaryTripType(types)];
  const Icon = meta.icon;
  return (
    <div className={cn("relative overflow-hidden", meta.cover, className)}>
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
          {/* Contour lines, like a hiking map */}
          <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_28%_115%,transparent_0_20px,rgb(255_255_255/0.09)_20px_22px)]" />
          <Icon className="absolute right-4 bottom-4 size-10 text-trail" strokeWidth={2} aria-hidden />
        </>
      )}
    </div>
  );
}
