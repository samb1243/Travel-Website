import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeButton } from "@/components/profile/unsubscribe-button";

export const metadata: Metadata = { title: "Reminder emails", robots: { index: false } };

// Opened from "Stop reminder emails" in a reminder. A button rather than
// switching off on opening the page: mail scanners open links too.
export default function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-8 text-center">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">Reminder emails</h1>
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/unsubscribe">, "searchParams">) {
  const q = await searchParams;
  const u = typeof q.u === "string" ? q.u : "";
  const t = typeof q.t === "string" ? q.t : "";
  return <UnsubscribeButton userId={u} token={t} />;
}
