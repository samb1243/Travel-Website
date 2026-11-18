"use client";

import { useEffect, useState } from "react";
import { WifiOffIcon } from "lucide-react";

/**
 * Registers the service worker (public/sw.js) that keeps trips for offline
 * use. Production only: in development it would hold on to old pages while
 * you edit code. Set NEXT_PUBLIC_OFFLINE_IN_DEV=1 to try it with `npm run dev`.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_OFFLINE_IN_DEV === "1";
    if (!enabled || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline copies are a bonus; the app works the same without them
    });
  }, []);
  return null;
}

/** When this page is a copy saved on the device (set by public/sw.js), when it was saved */
function savedCopyDate(): Date | null {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const entry = nav?.serverTiming?.find((e) => e.name === "saved-copy");
  const date = entry ? new Date(entry.description) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * A strip under the header while there's no connection, or while the page is
 * a saved copy because the connection didn't get through.
 */
export function OfflineBanner() {
  const [state, setState] = useState<{ offline: boolean; savedAt: Date | null }>({ offline: false, savedAt: null });
  useEffect(() => {
    const update = () => setState({ offline: !navigator.onLine, savedAt: savedCopyDate() });
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!state.offline && !state.savedAt) return null;
  const saved = state.savedAt
    ? ` Showing the copy saved ${state.savedAt.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
    : " Saved trips still open.";
  return (
    <div role="status" className="border-b bg-foreground text-background print:hidden">
      <p className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-sm font-medium">
        <WifiOffIcon className="size-4 shrink-0" aria-hidden />
        <span>
          {state.offline ? "You're offline." : "No connection to Tripster."}
          {saved} Changes need a connection.
        </span>
      </p>
    </div>
  );
}
