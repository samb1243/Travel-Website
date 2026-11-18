import type { Metadata } from "next";
import { Suspense } from "react";
import { TripForm } from "@/components/trip/trip-form";
import { Skeleton } from "@/components/ui/skeleton";
import { createTrip } from "@/server/actions/trips";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "New trip" };

export default function NewTripPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">Start a new trip</h1>
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-2xl" />}>
        <NewTripForm />
      </Suspense>
    </div>
  );
}

async function NewTripForm() {
  const user = await requireUser("/trips/new");
  return (
    <TripForm
      action={createTrip}
      submitLabel="Create trip"
      cancelHref="/dashboard"
      defaults={{
        title: "",
        types: [],
        startDate: "",
        endDate: "",
        currency: user.homeCurrency,
        budget: "",
        travellers: "1",
        description: "",
        coverImageUrl: "",
      }}
    />
  );
}
