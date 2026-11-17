import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A button when there's something to do on tap (the owner editing), plain
 * content otherwise (read-only shared views), so read-only pages don't show
 * controls that do nothing.
 */
export function Tappable({
  onClick,
  label,
  className,
  interactiveClassName,
  children,
}: {
  onClick?: () => void;
  label?: string;
  className?: string;
  /** Hover/focus styles, only applied when tappable */
  interactiveClassName?: string;
  children: ReactNode;
}) {
  if (!onClick) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        className,
        "text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        interactiveClassName,
      )}
    >
      {children}
    </button>
  );
}
