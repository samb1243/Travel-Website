"use client";

import { useRef, useState, useTransition } from "react";
import { CheckIcon, FileUpIcon, Loader2Icon, MailIcon, SparklesIcon } from "lucide-react";
import { CategoryTile } from "@/components/builder/category-tile";
import { ItemSheet, type ItemSheetState } from "@/components/builder/item-sheet";
import { ResponsiveSheet } from "@/components/builder/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseDateOnly } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { readBookingEmail, readBookingEmailWithClaude, type EmailImportResult, type FoundBooking } from "@/server/actions/email-import";
import type { BuilderStop } from "@/server/trips";

type Email = { subject: string; html: string; text: string };
type Found = Extract<EmailImportResult, { ok: true }>;

/**
 * "Import from email": paste a booking confirmation or open a saved .eml
 * file, see the bookings found in it, and add each one through the normal
 * item form (to check it first). Nothing is saved until you add it.
 */
export function EmailImport({
  tripId,
  currency,
  stops,
}: {
  tripId: string;
  currency: string;
  stops: Pick<BuilderStop, "id" | "name">[];
}) {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [email, setEmail] = useState<Email | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [sheet, setSheet] = useState<ItemSheetState>(null);
  const [checking, setChecking] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [asking, startAsking] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPasted("");
    setEmail(null);
    setFileName(null);
    setFound(null);
    setError(null);
    setAdded(new Set());
  }

  /** Opens a saved .eml file here in the browser: attachments never leave the device. */
  async function openFile(file: File) {
    setError(null);
    setFound(null);
    try {
      const { default: PostalMime } = await import("postal-mime");
      const parsed = await PostalMime.parse(await file.arrayBuffer());
      setEmail({ subject: parsed.subject ?? "", html: parsed.html ?? "", text: parsed.text ?? "" });
      setFileName(file.name);
      setPasted("");
    } catch {
      setError("Couldn't open that file. Save the email as .eml from your mail app, or copy and paste its text.");
    }
  }

  const current = (): Email | null => email ?? (pasted.trim() ? { subject: "", html: "", text: pasted } : null);

  function find() {
    const e = current();
    if (!e) return setError("Paste an email, or choose a saved .eml file.");
    if (e.html.length > 700_000 || e.text.length > 250_000) {
      return setError("That email is too big to read here. Copy and paste just the part with the booking.");
    }
    setError(null);
    start(async () => {
      const result = await readBookingEmail(tripId, e);
      if (!result.ok) return setError(result.message);
      setFound(result);
      setAdded(new Set());
    });
  }

  function askClaude() {
    const e = current();
    if (!e) return;
    setError(null);
    startAsking(async () => {
      const result = await readBookingEmailWithClaude(tripId, e);
      if (!result.ok) return setError(result.message);
      setFound(result);
      setAdded(new Set());
    });
  }

  /** Check one booking in the item form; the import sheet comes back afterwards */
  function check(index: number, b: FoundBooking) {
    setChecking(index);
    setOpen(false);
    setSheet({ mode: "add", stopId: b.stopId, defaultDate: "", draft: b });
  }

  const stopName = (id: string | null) => (id ? (stops.find((s) => s.id === id)?.name ?? "Whole trip") : "Whole trip");
  const remaining = found ? found.bookings.length - added.size : 0;

  return (
    <>
      <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(true)}>
        <MailIcon aria-hidden /> Import from email
      </Button>

      <ResponsiveSheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o && remaining === 0) reset();
        }}
        title="Import from email"
        description="Add bookings from a confirmation email. You check each one before it's added."
      >
        <div className="space-y-5">
          {!found ? (
            <>
              <div className="space-y-2">
                <label htmlFor="email-text" className="text-sm font-medium">
                  Paste the email
                </label>
                <Textarea
                  id="email-text"
                  rows={7}
                  value={pasted}
                  onChange={(e) => {
                    setPasted(e.target.value);
                    setEmail(null);
                    setFileName(null);
                  }}
                  placeholder="Open the confirmation email, select everything, copy and paste it here."
                  className="text-base md:text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">or</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".eml,message/rfc822"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void openFile(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" className="h-10" onClick={() => fileRef.current?.click()}>
                  <FileUpIcon aria-hidden /> Choose a saved email (.eml)
                </Button>
                {fileName ? (
                  <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <CheckIcon className="size-4 shrink-0" aria-hidden /> <span className="truncate">{email?.subject || fileName}</span>
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Saving as .eml: in Gmail, open the email, ⋮ → Download message. In Outlook, File → Save as. Copying the text works
                everywhere.
              </p>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="button" size="lg" className="h-12 w-full" disabled={pending} onClick={find}>
                {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
                Find bookings
              </Button>
            </>
          ) : (
            <>
              {found.bookings.length ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {found.source === "claude"
                      ? "Read by Claude. Check the details, especially dates and prices, before adding."
                      : "Found in the email's booking details."}
                  </p>
                  <ul className="space-y-2">
                    {found.bookings.map((b, i) => {
                      const done = added.has(i);
                      const when = b.startDate
                        ? `${formatDate(parseDateOnly(b.startDate), { weekday: true })}${b.startTime ? ` ${b.startTime}` : ""}`
                        : "No date";
                      return (
                        <li key={i} className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3", done && "opacity-60")}>
                          <CategoryTile category={b.category} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-pretty">{b.title || `${b.fromPlace} → ${b.toPlace}`}</span>
                            <span className="block text-sm text-muted-foreground">
                              {[when, stopName(b.stopId), b.confirmationCode ? `Ref ${b.confirmationCode}` : null].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          {done ? (
                            <span className="flex items-center gap-1 text-sm font-semibold">
                              <CheckIcon className="size-4" aria-hidden /> Added
                            </span>
                          ) : (
                            <Button type="button" className="h-10" onClick={() => check(i, b)}>
                              Check & add
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : found.canAskClaude ? (
                <div className="space-y-3 rounded-2xl border bg-card p-4">
                  <p className="font-semibold">This email doesn&apos;t have booking details built in.</p>
                  <p className="text-sm text-muted-foreground">
                    Claude can read the email and pull out the booking for you to check. The email&apos;s text is sent to Anthropic
                    (Claude&apos;s maker) to do this; nothing is added until you say so.
                  </p>
                  <Button type="button" className="h-11" disabled={asking} onClick={askClaude}>
                    {asking ? <Loader2Icon className="animate-spin" aria-hidden /> : <SparklesIcon aria-hidden />}
                    {asking ? "Reading…" : "Read it with Claude"}
                  </Button>
                </div>
              ) : (
                <p className="rounded-2xl border bg-card p-4 text-sm">
                  {found.source === "claude"
                    ? "Claude didn't find a booking in that email. Add it by hand instead."
                    : "No booking details found in that email. Add the booking by hand instead."}
                </p>
              )}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="button" variant="ghost" className="h-11 w-full" onClick={reset}>
                Import another email
              </Button>
            </>
          )}
        </div>
      </ResponsiveSheet>

      <ItemSheet
        tripId={tripId}
        currency={currency}
        stops={stops}
        state={sheet}
        onSaved={() => {
          if (checking !== null) setAdded((s) => new Set(s).add(checking));
        }}
        onClose={() => {
          setSheet(null);
          setChecking(null);
          setOpen(true); // back to the list, to add the next one
        }}
      />
    </>
  );
}
