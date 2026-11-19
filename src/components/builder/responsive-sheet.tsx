"use client";

import { useRef, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

/** Bottom sheet on phones (easy to reach with a thumb), side panel on larger screens. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const desktop = useMediaQuery("(min-width: 768px)");
  // These sheets open from code (tapping a card), not from a dialog trigger, so
  // remember what had focus and give it back on close: keyboard and screen
  // reader users land where they were, not at the top of the page.
  const returnFocusTo = useRef<HTMLElement | null>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        onOpenAutoFocus={() => {
          const el = document.activeElement;
          returnFocusTo.current = el instanceof HTMLElement && el !== document.body ? el : null;
        }}
        onCloseAutoFocus={(e) => {
          const el = returnFocusTo.current;
          if (el?.isConnected) {
            e.preventDefault();
            el.focus();
          }
        }}
        className={
          desktop
            ? "w-full gap-0 overflow-x-hidden overflow-y-auto sm:max-w-lg"
            : "max-h-[92dvh] gap-0 overflow-x-hidden overflow-y-auto rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
        }
      >
        <SheetHeader className="sticky top-0 z-10 border-b bg-popover/95 backdrop-blur">
          <SheetTitle className="font-heading text-lg">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
