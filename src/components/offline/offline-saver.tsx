"use client";

import { useEffect, useRef, useState } from "react";
import { CloudDownloadIcon, Loader2Icon, WifiOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { offlinePagesFor, offlineSupported, readOfflineIndex, RESAVE_AFTER_MS, saveForOffline, savedTripsFrom } from "@/lib/offline";

type Status = { saving: boolean; trips: number; savedAt: number | null; failed: number };

const ago = (ms: number) => {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

/**
 * On My trips: keeps your current and upcoming trips saved on this device for
 * offline use, refreshing them in the background, and says how fresh they are.
 */
export function OfflineSaver({ userId, trips }: { userId: string; trips: { id: string; title: string }[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  // The latest props, for the save that runs once after the page loads
  const latest = useRef({ userId, trips });
  useEffect(() => {
    latest.current = { userId, trips };
  });

  async function readStatus(failed = 0) {
    const index = await readOfflineIndex();
    const mine = index && index.user === latest.current.userId ? index : null;
    setStatus({ saving: false, trips: mine ? savedTripsFrom(mine).length : 0, savedAt: mine?.savedAt ?? null, failed });
    return mine;
  }

  async function save() {
    const { userId: user, trips: list } = latest.current;
    if (!navigator.onLine || list.length === 0) return;
    setStatus((s) => ({ trips: 0, savedAt: null, failed: 0, ...s, saving: true }));
    const result = await saveForOffline(user, offlinePagesFor(list)).catch(() => null);
    await readStatus(result?.failed ?? 0);
  }

  // Once per visit: show what's saved, and refresh it if it's getting old
  useEffect(() => {
    // No service worker yet (first visit, or development): nothing to show
    if (!offlineSupported() || !navigator.serviceWorker.controller) return;
    let cancelled = false;
    void (async () => {
      const index = await readStatus();
      if (!cancelled && (!index?.savedAt || Date.now() - index.savedAt > RESAVE_AFTER_MS)) await save();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; reads the latest props from the ref
  }, []);

  if (trips.length === 0 || !status || (!status.saving && status.savedAt === null)) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-card px-4 py-3 text-sm">
      <WifiOffIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1" aria-live="polite">
        {status.saving ? (
          "Saving your trips for offline use…"
        ) : (
          <>
            <span className="font-semibold">{plural(status.trips, "trip")} saved for offline use</span>
            {status.savedAt ? <span className="text-muted-foreground"> · updated {ago(status.savedAt)}</span> : null}
            {status.failed ? <span className="text-muted-foreground"> · some pages couldn&apos;t be saved</span> : null}
          </>
        )}
      </p>
      <Button type="button" variant="outline" size="sm" className="h-9" disabled={status.saving} onClick={() => void save()}>
        {status.saving ? <Loader2Icon className="animate-spin" aria-hidden /> : <CloudDownloadIcon aria-hidden />}
        Update now
      </Button>
    </div>
  );
}
