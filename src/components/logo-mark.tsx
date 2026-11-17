import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Tripster mark: a golden sun setting behind mountains, with a dotted trail
 * winding towards them. Same artwork as src/app/icon.svg (the favicon).
 */
export function LogoMark({ className }: { className?: string }) {
  const clip = `${useId().replace(/:/g, "")}-tile`;
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <rect width="32" height="32" rx="9" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="32" height="32" fill="#b4553a" />
        <circle cx="20" cy="13.5" r="5.5" fill="#f6c56b" />
        <path d="M-1 24 L10.5 13.5 L16 19 L20.5 15 L33 25 V33 H-1 Z" fill="#fbf3e4" />
        <path
          d="M9 33 C 11 28.5, 19 29, 17 25.5 S 14.5 21.5, 17.5 19.8"
          fill="none"
          stroke="#b4553a"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeDasharray="0.1 2.7"
        />
      </g>
    </svg>
  );
}
