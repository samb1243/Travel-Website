"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BellOffIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unsubscribeFromEmail } from "@/server/actions/reminders";

export function UnsubscribeButton({ userId, token }: { userId: string; token: string }) {
  const [state, setState] = useState<"idle" | "done" | "invalid">("idle");
  const [pending, start] = useTransition();

  if (state === "done") {
    return (
      <p className="text-muted-foreground">
        Done: no more reminder emails. You can switch them back on in your{" "}
        <Link href="/profile" className="font-semibold text-foreground underline underline-offset-4">
          profile
        </Link>
        .
      </p>
    );
  }
  if (state === "invalid" || !userId || !token) {
    return <p className="text-muted-foreground">This link doesn&apos;t work. Switch reminders off in your profile instead.</p>;
  }
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Stop emails about bookings coming up and trips starting tomorrow?</p>
      <Button
        size="lg"
        className="h-12"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await unsubscribeFromEmail(userId, token);
            setState(r.ok ? "done" : "invalid");
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <BellOffIcon aria-hidden />}
        Stop reminder emails
      </Button>
    </div>
  );
}
