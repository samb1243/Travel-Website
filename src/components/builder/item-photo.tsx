/* eslint-disable @next/next/no-img-element -- photos come from any site or from /img uploads; sizes are unknown */

/** A booking's photo: full width, cropped to a calm 16:9, loaded lazily. */
export function ItemPhoto({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={["aspect-video w-full rounded-lg bg-muted object-cover", className].filter(Boolean).join(" ")}
    />
  );
}
