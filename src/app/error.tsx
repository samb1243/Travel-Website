"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/**
 * When a page breaks, inside the normal header and layout. Server errors
 * arrive with a reference (digest) instead of details, so nothing sensitive
 * shows; the reference matches the server log.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const ref = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <EmptyState
      icon={TriangleAlertIcon}
      title="Something went wrong"
      action={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => retry()}>
            <RotateCcwIcon aria-hidden /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to My trips</Link>
          </Button>
        </div>
      }
    >
      That page didn&apos;t load. Your trips are safe; try again in a moment.
      {ref ? <span className="mt-2 block text-xs">Reference: {ref}</span> : null}
    </EmptyState>
  );
}
