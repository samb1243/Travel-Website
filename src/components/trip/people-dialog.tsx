"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, Link2OffIcon, LinkIcon, LogOutIcon, UserMinusIcon, UsersIcon } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { INVITE_DAYS, MAX_TRIP_PEOPLE } from "@/lib/limits";
import { createInviteLink, leaveTrip, removeMember, turnOffInviteLink } from "@/server/actions/people";
import type { TripPeople } from "@/server/people";

/**
 * Who's planning this trip. The owner can invite people with a link and remove
 * them; members can leave.
 */
export function PeopleDialog({
  tripId,
  viewerId,
  isOwner,
  people,
  invite,
}: {
  tripId: string;
  viewerId: string;
  isOwner: boolean;
} & TripPeople) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

  function run(action: () => Promise<{ ok: boolean; message?: string }>, done?: string) {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) throw new Error(result.message);
        if (done) toast.success(done);
      } catch (e) {
        toast.error(e instanceof Error && e.message ? e.message : "That didn't work. Try again.");
      }
    });
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  }

  const others = people.length - 1;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-11 shrink-0 rounded-xl border-2 px-4 font-bold">
          <UsersIcon aria-hidden /> People
          {others > 0 ? <span className="text-muted-foreground tabular-nums">{people.length}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan this trip together</DialogTitle>
          <DialogDescription>
            Everyone here can add and edit stops and bookings, and see confirmation numbers and private notes.
            {isOwner ? " Only you can delete the trip, change who can see it, or manage people." : ""}
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-xl border">
          {people.map((p) => {
            const you = p.id === viewerId;
            return (
              <li key={p.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                <UserAvatar name={p.name} image={p.image} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {p.name}
                    {you ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
                  </span>
                  <span className="block text-sm text-muted-foreground">{p.isOwner ? "Owner" : "Can edit"}</span>
                </span>
                {isOwner && !p.isOwner ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 rounded-lg"
                    disabled={pending}
                    aria-label={`Remove ${p.name} from this trip`}
                    onClick={() => {
                      if (window.confirm(`Remove ${p.name}? They won't be able to see or edit this trip any more.`)) {
                        run(() => removeMember(tripId, p.id), `${p.name} removed`);
                      }
                    }}
                  >
                    <UserMinusIcon aria-hidden />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {isOwner ? (
          <section className="space-y-3" aria-labelledby="invite-heading">
            <div>
              <h3 id="invite-heading" className="font-bold">
                Invite people
              </h3>
              <p className="text-sm text-muted-foreground">
                Send this link to people you&apos;re travelling with. Anyone who opens it and logs in can join and edit the
                trip, so only share it with them. Up to {MAX_TRIP_PEOPLE} people.
              </p>
            </div>
            {invite ? (
              <>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={inviteUrl(invite.token)}
                    aria-label="Invite link"
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-11 min-w-0 flex-1 rounded-lg border bg-muted px-3 font-mono text-sm"
                  />
                  <Button type="button" className="h-11 shrink-0 rounded-lg" onClick={() => copy(invite.token)}>
                    {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />} Copy
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>Works until {formatDate(new Date(invite.expiresAt))}</span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 rounded-lg px-2 font-semibold"
                      disabled={pending}
                      onClick={() => run(() => createInviteLink(tripId), "New link made. The old one no longer works.")}
                    >
                      <LinkIcon aria-hidden /> New link
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 rounded-lg px-2 font-semibold"
                      disabled={pending}
                      onClick={() => run(() => turnOffInviteLink(tripId), "Invite link turned off")}
                    >
                      <Link2OffIcon aria-hidden /> Turn off
                    </Button>
                  </span>
                </div>
              </>
            ) : (
              <Button
                type="button"
                className="h-11 w-full rounded-lg"
                disabled={pending}
                onClick={() => run(() => createInviteLink(tripId), `Invite link made. It works for ${INVITE_DAYS} days.`)}
              >
                <LinkIcon aria-hidden /> Make an invite link
              </Button>
            )}
          </section>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-lg"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Leave this trip? You'll need a new invite to get back in.")) return;
              startTransition(async () => {
                // On success this redirects to My trips, so there's normally no result.
                const result = await leaveTrip(tripId);
                if (result && !result.ok) toast.error(result.message ?? "Couldn't leave the trip. Try again.");
              });
            }}
          >
            <LogOutIcon aria-hidden /> Leave trip
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
