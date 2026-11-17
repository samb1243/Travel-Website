import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Decorative "view from the plane window at golden hour" illustration.
 * Pure SVG, so no image licensing and it scales to any size.
 */
export function WindowView({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 300 420"
      role="img"
      aria-label="Sunset over the clouds seen through an aeroplane window"
      className={cn("h-auto w-full", className)}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f3d63" />
          <stop offset="0.32" stopColor="#7a5c7e" />
          <stop offset="0.52" stopColor="#d9826a" />
          <stop offset="0.64" stopColor="#f4b25f" />
          <stop offset="0.7" stopColor="#fbd88f" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.25" stopColor="#ffe3a1" stopOpacity="0.95" />
          <stop offset="1" stopColor="#f7b660" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-clouds`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d3b0" />
          <stop offset="0.5" stopColor="#c9a7b4" />
          <stop offset="1" stopColor="#6c6a8c" />
        </linearGradient>
        <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9e4dc" />
          <stop offset="1" stopColor="#8e8a93" />
        </linearGradient>
        <clipPath id={`${id}-pane`}>
          <rect x="42" y="42" width="216" height="336" rx="104" />
        </clipPath>
      </defs>

      {/* Window frame */}
      <rect x="14" y="14" width="272" height="392" rx="128" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="32" y="32" width="236" height="356" rx="114" className="fill-muted" />

      <g clipPath={`url(#${id}-pane)`}>
        <rect x="0" y="0" width="300" height="420" fill={`url(#${id}-sky)`} />
        {/* High wispy clouds */}
        <g fill="#f3b9a0" opacity="0.55">
          <ellipse cx="110" cy="120" rx="70" ry="5" />
          <ellipse cx="190" cy="138" rx="60" ry="4" />
          <ellipse cx="90" cy="160" rx="50" ry="3.5" />
        </g>
        {/* Sun on the horizon */}
        <circle cx="168" cy="262" r="70" fill={`url(#${id}-sun)`} />
        {/* Sea of clouds */}
        <rect x="0" y="268" width="300" height="160" fill={`url(#${id}-clouds)`} />
        <g fill="#fbe2c6" opacity="0.8">
          <ellipse cx="80" cy="276" rx="60" ry="10" />
          <ellipse cx="220" cy="282" rx="70" ry="11" />
          <ellipse cx="150" cy="300" rx="90" ry="12" opacity="0.6" />
        </g>
        <g fill="#b48fa0" opacity="0.5">
          <ellipse cx="60" cy="330" rx="80" ry="14" />
          <ellipse cx="240" cy="350" rx="90" ry="16" />
        </g>
        {/* Wing */}
        <path d="M300 300 L150 336 L146 344 L300 330 Z" fill={`url(#${id}-wing)`} />
        <path d="M168 334 L162 318 L170 316 L178 332 Z" fill="#cfc9c1" />
        {/* Glass reflection */}
        <path d="M70 90 Q90 60 130 52" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>

      {/* Window shade, pulled up */}
      <rect x="96" y="22" width="108" height="8" rx="4" className="fill-border" />
    </svg>
  );
}
