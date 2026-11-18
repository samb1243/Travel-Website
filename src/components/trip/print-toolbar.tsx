"use client";

import Link from "next/link";
import { ArrowLeftIcon, EyeOffIcon, PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Controls above the printable itinerary; hidden on paper. */
export function PrintToolbar({ tripId, showPrivate }: { tripId: string; showPrivate: boolean }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 print:hidden">
      <Button asChild variant="ghost" className="h-11 rounded-xl px-3 font-semibold">
        <Link href={`/trips/${tripId}`}>
          <ArrowLeftIcon aria-hidden /> Back to trip
        </Link>
      </Button>
      <span className="flex-1" />
      <Button asChild variant="outline" className="h-11 rounded-xl border-2 px-3 font-semibold">
        <Link href={showPrivate ? `/trips/${tripId}/print?private=0` : `/trips/${tripId}/print`} replace scroll={false}>
          <EyeOffIcon aria-hidden /> {showPrivate ? "Hide private details" : "Show private details"}
        </Link>
      </Button>
      <Button type="button" className="h-11 rounded-xl px-4 font-bold" onClick={() => window.print()}>
        <PrinterIcon aria-hidden /> Print or save as PDF
      </Button>
    </div>
  );
}
