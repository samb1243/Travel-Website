import { cn } from "@/lib/utils";

/**
 * Tripster mark: a trail signpost, two yellow boards pointing opposite ways
 * on a pine tile. Same artwork as src/app/icon.svg (the favicon).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1c3a32" />
      <rect x="10.4" y="5.5" width="2.6" height="22" rx="0.6" fill="#cfdad5" />
      <path d="M5.5 8.5 H21.5 L25.5 12 L21.5 15.5 H5.5 Z" fill="#f4c430" />
      <path d="M10 18 H26.5 V25 H10 L6 21.5 Z" fill="#f4c430" />
    </svg>
  );
}
