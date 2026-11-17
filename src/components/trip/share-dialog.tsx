"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VISIBILITY_META } from "@/lib/trip-types";
import { cn } from "@/lib/utils";
import type { Visibility } from "@/generated/prisma/enums";
import { setVisibility } from "@/server/actions/sharing";

const OPTIONS: Visibility[] = ["PRIVATE", "UNLISTED", "PUBLIC"];

/** Owner's share settings: who can see the trip, and its link. */
export function ShareDialog({ tripId, slug, visibility }: { tripId: string; slug: string; visibility: Visibility }) {
  const [current, setCurrent] = useState(visibility);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const path = `/t/${slug}`;

  function choose(next: Visibility) {
    if (next === current) return;
    const previous = current;
    setCurrent(next);
    startTransition(async () => {
      try {
        const result = await setVisibility(tripId, next);
        if (!result.ok) throw new Error(result.message);
        toast.success(`Trip is now ${VISIBILITY_META[next].label.toLowerCase()}`);
      } catch {
        setCurrent(previous);
        toast.error("Couldn't change who can see it. Try again.");
      }
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Open the preview and copy the address instead.");
    }
  }

  const shareable = current !== "PRIVATE";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="lg" className="h-10 shrink-0 bg-white/90 text-neutral-900 hover:bg-white">
          <Share2Icon aria-hidden /> <span className="sr-only sm:not-sr-only">Share</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this trip</DialogTitle>
          <DialogDescription>Choose who can see it. Shared trips are read-only, and anyone who can see one can copy it.</DialogDescription>
        </DialogHeader>

        <fieldset className="min-w-0 space-y-2" disabled={pending}>
          <legend className="sr-only">Who can see this trip</legend>
          {OPTIONS.map((v) => {
            const meta = VISIBILITY_META[v];
            const Icon = meta.icon;
            const active = v === current;
            return (
              <label
                key={v}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  active ? "border-primary bg-primary/5" : "hover:bg-accent/50",
                )}
              >
                <input type="radio" name="visibility" value={v} checked={active} onChange={() => choose(v)} className="sr-only" />
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", active ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{meta.label}</span>
                  <span className="block text-sm text-muted-foreground">{meta.description}</span>
                </span>
                {active ? <CheckIcon className="size-5 text-primary" aria-hidden /> : null}
              </label>
            );
          })}
        </fieldset>

        {shareable ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={copyLink} className="h-11 sm:flex-1">
              {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />} Copy link
            </Button>
            <Button asChild variant="outline" className="h-11 sm:flex-1">
              <Link href={path} target="_blank">
                <EyeIcon aria-hidden /> Preview
              </Link>
            </Button>
          </div>
        ) : (
          <Button asChild variant="outline" className="h-11">
            <Link href={path} target="_blank">
              <EyeIcon aria-hidden /> Preview what others would see
            </Link>
          </Button>
        )}

        <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          <EyeOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          Never shown or copied: confirmation numbers, private notes and “Confirmation” links. Everything else on the
          trip, including costs and shared notes, is visible to people you share it with.
        </p>
      </DialogContent>
    </Dialog>
  );
}
