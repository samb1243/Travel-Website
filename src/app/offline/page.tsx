import type { Metadata } from "next";
import { SavedTripsList } from "@/components/offline/saved-trips-list";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

// Shown by the service worker when there's no connection and the page you
// asked for isn't saved on this device. Static: the list of saved trips is
// read from this device, not the server.
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">You&apos;re offline</h1>
        <p className="text-muted-foreground">
          That page isn&apos;t saved on this device. These trips are, and open without a connection:
        </p>
      </div>
      <SavedTripsList />
    </div>
  );
}
