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
  /**
   * Said before the visible content by screen readers, e.g. "Edit". Added to
   * the content rather than replacing it, so the spoken name always contains
   * what's on screen (WCAG 2.5.3, label in name).
   */
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
      className={cn(
        className,
        "text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        interactiveClassName,
      )}
    >
      {label ? <span className="sr-only">{label} </span> : null}
      {children}
    </button>
  );
}
