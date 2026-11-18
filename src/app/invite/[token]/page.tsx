import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Link2OffIcon } from "lucide-react";
import { JoinTripButton } from "@/components/trip/join-trip-button";
import { TripCover } from "@/components/trip/trip-cover";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateRange, plural } from "@/lib/format";
import { formatTripTypes } from "@/lib/trip-types";
import { getInvite } from "@/server/people";
import { requireUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Join a trip",
  robots: { index: false, follow: false },
};

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <div className="mx-auto max-w-lg">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <Invite params={params} />
      </Suspense>
    </div>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser(`/invite/${encodeURIComponent(token)}`);
  const invite = await getInvite(token, user.id);

  if (!invite) {
    return (
      <EmptyState
        icon={Link2OffIcon}
        title="This invite link doesn't work"
        action={
          <Button asChild size="lg">
            <Link href="/dashboard">Go to my trips</Link>
          </Button>
        }
      >
        It may have expired or been turned off. Ask the person who sent it for a new link.
      </EmptyState>
    );
  }
  if (invite.alreadyIn) redirect(`/trips/${invite.tripId}`);

  const dates = formatDateRange(invite.startDate, invite.endDate);
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl">
        <TripCover types={invite.types} coverImageUrl={invite.coverImageUrl} priority className="aspect-[2/1]" />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground">
          <span className="font-bold text-foreground">{invite.ownerName}</span> invited you to plan this trip together
        </p>
        <h1 className="font-heading text-4xl leading-none font-black tracking-[-0.02em] text-balance">{invite.title}</h1>
        <p className="text-sm font-semibold text-muted-foreground">
          {[formatTripTypes(invite.types), dates, plural(invite.stopCount, "stop"), plural(invite.peopleCount, "person", "people")]
            .filter(Boolean)
            .join(", ")}
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        <p>
          You&apos;ll be able to add and edit stops and bookings, and see everyone&apos;s confirmation numbers and
          private notes for this trip. You can leave at any time.
        </p>
        <JoinTripButton token={token} />
      </div>
    </div>
  );
}
