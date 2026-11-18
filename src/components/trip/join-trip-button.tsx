"use client";

import { useState, useTransition } from "react";
import { UserPlusIcon } from "lucide-react";
import { FormError } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/server/actions/people";

/** Joins the trip; on success the action redirects to it. */
export function JoinTripButton({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <FormError message={error} />
      <Button
        type="button"
        size="lg"
        className="h-12 w-full rounded-xl text-base font-bold"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await acceptInvite(token);
            if (result && !result.ok) setError(result.message ?? "Couldn't join the trip. Try again.");
          })
        }
      >
        <UserPlusIcon aria-hidden /> {pending ? "Joining…" : "Join trip"}
      </Button>
    </div>
  );
}
