"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { BookmarkCheckIcon, BookmarkIcon, CopyPlusIcon, Share2Icon } from "lucide-react";
import { FormError, SubmitButton } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyTrip, setSaved } from "@/server/actions/sharing";

/** Copy / Save / Share buttons on a shared trip page. */
export function SharedTripActions({
  tripId,
  slug,
  title,
  startDate,
  shareable,
  signedIn,
  isOwner,
  saved,
  saveCount,
}: {
  tripId: string;
  slug: string;
  title: string;
  startDate: string | null;
  /** False for the owner's preview of a private trip: the link wouldn't work for anyone else */
  shareable: boolean;
  signedIn: boolean;
  isOwner: boolean;
  saved: boolean;
  saveCount: number;
}) {
  const loginHref = `/login?next=${encodeURIComponent(`/t/${slug}`)}`;

  return (
    <div className="flex flex-wrap gap-2">
      {signedIn ? (
        <CopyDialog tripId={tripId} title={title} startDate={startDate} isOwner={isOwner} />
      ) : (
        <Button asChild size="lg" className="h-11">
          <Link href={loginHref}>
            <CopyPlusIcon aria-hidden /> Copy this trip
          </Link>
        </Button>
      )}
      {isOwner ? null : signedIn ? (
        <SaveButton tripId={tripId} saved={saved} saveCount={saveCount} />
      ) : (
        <Button asChild size="lg" variant="outline" className="h-11">
          <Link href={loginHref}>
            <BookmarkIcon aria-hidden /> Save{saveCount ? ` · ${saveCount}` : ""}
          </Link>
        </Button>
      )}
      {shareable ? <ShareButton title={title} /> : null}
    </div>
  );
}

function SaveButton({ tripId, saved, saveCount }: { tripId: string; saved: boolean; saveCount: number }) {
  const [state, setState] = useOptimistic({ saved, saveCount });
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !state.saved;
    startTransition(async () => {
      setState({ saved: next, saveCount: state.saveCount + (next ? 1 : -1) });
      try {
        const result = await setSaved(tripId, next);
        if (!result.ok) throw new Error(result.message);
        toast.success(next ? "Saved. Find it under My trips." : "Removed from saved trips");
      } catch (e) {
        toast.error(e instanceof Error && e.message ? e.message : "Couldn't save. Try again.");
      }
    });
  }

  const Icon = state.saved ? BookmarkCheckIcon : BookmarkIcon;
  return (
    <Button type="button" size="lg" variant={state.saved ? "secondary" : "outline"} className="h-11" aria-pressed={state.saved} onClick={toggle}>
      <Icon aria-hidden /> {state.saved ? "Saved" : "Save"}
      {state.saveCount ? <span className="text-muted-foreground tabular-nums">· {state.saveCount}</span> : null}
    </Button>
  );
}

function ShareButton({ title }: { title: string }) {
  async function share() {
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // closed the share sheet
      toast.error("Couldn't share. Copy the address from your browser instead.");
    }
  }
  return (
    <Button type="button" size="lg" variant="outline" className="h-11" onClick={share}>
      <Share2Icon aria-hidden /> Share
    </Button>
  );
}

function CopyDialog({
  tripId,
  title,
  startDate,
  isOwner,
}: {
  tripId: string;
  title: string;
  startDate: string | null;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const newStart = String(new FormData(e.currentTarget).get("startDate") ?? "");
    setError(null);
    startTransition(async () => {
      // On success the action redirects to the new trip.
      const result = await copyTrip(tripId, { startDate: newStart });
      if (!result.ok) setError(result.errors?.startDate ?? result.message ?? "Couldn't copy the trip. Try again.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-11">
          <CopyPlusIcon aria-hidden /> {isOwner ? "Duplicate" : "Copy this trip"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{isOwner ? "Duplicate this trip" : "Copy this trip"}</DialogTitle>
            <DialogDescription>
              You&apos;ll get your own private copy of “{title}” with every stop and booking idea, all set to{" "}
              <strong>To book</strong>. {isOwner ? "" : "Their confirmation numbers and private notes aren't included."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="copy-start">When do you want to go? (optional)</Label>
            <Input id="copy-start" name="startDate" type="date" className="h-12 text-base md:text-sm" />
            <p className="text-sm text-muted-foreground">
              {startDate
                ? "Every date moves to match. Leave it empty to keep the original dates."
                : "This trip has no dates, so this is only used if you add some."}
            </p>
          </div>
          <FormError message={error} />
          <DialogFooter>
            <SubmitButton pending={pending}>{isOwner ? "Duplicate" : "Copy to my trips"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
