"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setEmailReminders } from "@/server/actions/reminders";

/** Profile: reminder emails on or off. Saves as soon as it's switched. */
export function ReminderSettings({ on }: { on: boolean }) {
  const [shown, setShown] = useOptimistic(on);
  const [, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const next = !shown;
      setShown(next);
      try {
        await setEmailReminders(next);
        toast.success(next ? "Reminder emails on" : "Reminder emails off");
      } catch {
        toast.error("Couldn't save that. Try again.");
      }
    });

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <p id="reminders-label" className="font-semibold">
          Reminder emails
        </p>
        <p id="reminders-hint" className="text-sm text-muted-foreground">
          An email when something still to book is 2 weeks and 3 days away, and the day before a trip starts.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-labelledby="reminders-label"
        aria-describedby="reminders-hint"
        onClick={toggle}
        className={cn(
          "relative mt-0.5 inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          shown ? "bg-primary" : "bg-input",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block size-7 rounded-full bg-background shadow transition-transform",
            shown ? "translate-x-6" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
