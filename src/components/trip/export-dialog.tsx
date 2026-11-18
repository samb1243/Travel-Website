"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlusIcon, CheckIcon, CopyIcon, DownloadIcon, PrinterIcon, RefreshCwIcon, ShareIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getCalendarLink, resetCalendarLink, turnOffCalendarLink } from "@/server/actions/calendar";

/** Calendar (download or private live link) and printing, for anyone who can edit the trip. */
export function ExportDialog({ tripId, feedToken }: { tripId: string; feedToken: string | null }) {
  const [token, setToken] = useState(feedToken);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const feedUrl = (t: string) => `${window.location.origin}/cal/${t}.ics`;
  const webcalUrl = (t: string) => feedUrl(t).replace(/^https?:/, "webcal:");

  function run(action: () => Promise<{ ok: boolean; token?: string; message?: string }>, done: string, next?: "clear") {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) throw new Error(result.message);
        setToken(next === "clear" ? null : (result.token ?? null));
        toast.success(done);
      } catch {
        toast.error("That didn't work. Try again.");
      }
    });
  }

  async function copy(t: string) {
    try {
      await navigator.clipboard.writeText(feedUrl(t));
      setCopied(true);
      toast.success("Calendar link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-11 shrink-0 rounded-xl border-2 px-4 font-bold">
          <ShareIcon aria-hidden /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendar and print</DialogTitle>
          <DialogDescription>Take the trip with you: in your calendar, or on paper.</DialogDescription>
        </DialogHeader>

        <section className="space-y-3" aria-labelledby="calendar-heading">
          <div>
            <h3 id="calendar-heading" className="flex items-center gap-2 font-bold">
              <CalendarPlusIcon className="size-4" aria-hidden /> Keep it in your calendar
            </h3>
            <p className="text-sm text-muted-foreground">
              Subscribe once and your calendar app keeps up as the trip changes. Bookings show in local time, stops as
              all-day events.
            </p>
          </div>
          {token ? (
            <>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={feedUrl(token)}
                  aria-label="Your calendar link"
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-11 min-w-0 flex-1 rounded-lg border bg-muted px-3 font-mono text-sm"
                />
                <Button type="button" className="h-11 shrink-0 rounded-lg" onClick={() => copy(token)}>
                  {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />} Copy
                </Button>
              </div>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <span className="font-semibold">Apple Calendar:</span>{" "}
                  <a href={webcalUrl(token)} className="font-semibold text-lake underline underline-offset-4">
                    subscribe on this device
                  </a>
                </li>
                <li>
                  <span className="font-semibold">Google Calendar:</span> Other calendars, then <em>+</em>, then{" "}
                  <em>From URL</em>, and paste the link.
                </li>
                <li>
                  <span className="font-semibold">Outlook:</span> Add calendar, then <em>Subscribe from web</em>.
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                This link is just for you and includes confirmation numbers (not private notes), so don&apos;t share it.
                Calendar apps check it every few hours.
              </p>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-lg px-2 font-semibold"
                  disabled={pending}
                  onClick={() => run(() => resetCalendarLink(tripId), "New link made. The old one stops updating.")}
                >
                  <RefreshCwIcon aria-hidden /> Reset link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-lg px-2 font-semibold"
                  disabled={pending}
                  onClick={() => run(() => turnOffCalendarLink(tripId), "Calendar link turned off", "clear")}
                >
                  <XIcon aria-hidden /> Stop syncing
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              className="h-11 w-full rounded-lg"
              disabled={pending}
              onClick={() => run(() => getCalendarLink(tripId), "Calendar link ready")}
            >
              <CalendarPlusIcon aria-hidden /> Make my calendar link
            </Button>
          )}
          <Button asChild variant="outline" className="h-11 w-full rounded-lg">
            <a href={`/trips/${tripId}/calendar.ics`} download>
              <DownloadIcon aria-hidden /> Download a calendar file (.ics) instead
            </a>
          </Button>
        </section>

        <section className="space-y-2 border-t pt-4" aria-labelledby="print-heading">
          <h3 id="print-heading" className="flex items-center gap-2 font-bold">
            <PrinterIcon className="size-4" aria-hidden /> Print or save as PDF
          </h3>
          <p className="text-sm text-muted-foreground">
            A clean day-by-day copy with confirmation numbers, for your bag or for someone at home.
          </p>
          <Button asChild className="h-11 w-full rounded-lg">
            <Link href={`/trips/${tripId}/print`}>
              <PrinterIcon aria-hidden /> Open printable itinerary
            </Link>
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  );
}
