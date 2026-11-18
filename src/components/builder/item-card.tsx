"use client";

import { ItemPrice } from "@/components/builder/item-price";
import { CategoryTile } from "@/components/builder/category-tile";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRightIcon, CheckIcon, CopyIcon, LockIcon } from "lucide-react";
import { LINK_KIND_META, linkButtonLabel } from "@/lib/item-categories";
import { formatItemWhen } from "@/lib/format";
import { mapLinksFor } from "@/lib/map-links";
import { ItemPhoto } from "@/components/builder/item-photo";
import { STATUS_META } from "@/lib/status";
import { AddConfirmationChip, MapLinks, StatusBadges } from "@/components/builder/status-badges";
import { cn } from "@/lib/utils";
import { Tappable } from "@/components/tappable";
import { initials } from "@/components/user-avatar";
import type { BuilderItem } from "@/server/trips";

export function ItemCard({
  item,
  currency,
  onEdit,
  showStatus = true,
}: {
  item: BuilderItem;
  currency: string;
  /** Omit for read-only shared views */
  onEdit?: () => void;
  /** Booking status is the owner's own business: hidden on other people's trips */
  showStatus?: boolean;
}) {
  const status = item.status ? STATUS_META[item.status] : null;
  const when = formatItemWhen(item.startAt, item.endAt, item.allDay);
  const showRoute = item.fromPlace && item.toPlace && item.title !== `${item.fromPlace} → ${item.toPlace}`;

  return (
    <div className={cn("rounded-xl border bg-card", showStatus && status && cn("border-l-[5px]", status.border))}>
      <Tappable
        onClick={onEdit}
        label={`Edit ${item.title}`}
        className="flex w-full items-start gap-2.5 rounded-xl p-3"
        interactiveClassName="hover:bg-accent/40"
      >
        <CategoryTile category={item.category} className="mt-0.5" />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-start justify-between gap-2">
            <span className="leading-snug font-bold text-pretty">{item.title}</span>
            <ItemPrice item={item} tripCurrency={currency} className="font-extrabold" />
          </span>
          {showRoute ? (
            <span className="block text-sm text-muted-foreground">
              {item.fromPlace}{" "}
              <ArrowRightIcon className="inline size-3.5 align-[-2px]" aria-label="to" /> {item.toPlace}
            </span>
          ) : null}
          {when || item.provider ? (
            <span className="block text-sm text-muted-foreground">
              {[when, item.provider].filter(Boolean).join(" · ")}
            </span>
          ) : null}
          {item.address ? <span className="block text-sm text-muted-foreground">{item.address}</span> : null}
          {item.notes ? <span className="block text-sm text-pretty whitespace-pre-line">{item.notes}</span> : null}
          {showStatus ? <StatusBadges status={item.status} payment={item.payment} /> : null}
          <AddedBy who={item.addedBy} />
        </span>
      </Tappable>

      {item.imageUrl ? (
        <div className="px-3 pb-3">
          <ItemPhoto src={item.imageUrl} alt={item.title} />
        </div>
      ) : null}

      {item.links.length || item.confirmationCode || item.needsOwnConfirmation || mapLinksFor(item).length ? (
        <div className="flex flex-wrap gap-2 px-3 pb-3">
          {item.needsOwnConfirmation && onEdit ? <AddConfirmationChip onClick={onEdit} className="h-10 rounded-lg px-3 text-sm" /> : null}
          {item.confirmationCode ? <CopyCode code={item.confirmationCode} /> : null}
          <MapLinks item={item} className="contents" />
          {item.links.map((l) => {
            const LinkIcon = LINK_KIND_META[l.kind].icon;
            return (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-semibold hover:bg-accent"
              >
                <LinkIcon className="size-4 text-muted-foreground" aria-hidden />
                {linkButtonLabel(l)}
                {l.kind === "CONFIRMATION" ? <LockIcon className="size-3 text-muted-foreground" aria-label="private" /> : null}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** "Added by Lukas" / "Added by you", on trips planned together. */
export function AddedBy({ who, className }: { who: BuilderItem["addedBy"]; className?: string }) {
  if (!who) return null;
  return (
    <span className={cn("mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span
        className="grid size-4.5 shrink-0 place-items-center rounded-full bg-muted text-[0.625rem] font-bold text-foreground"
        aria-hidden
      >
        {initials(who.name)}
      </span>
      Added by {who.isYou ? "you" : who.name}
    </span>
  );
}

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          toast.success("Confirmation number copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy. Long-press the code instead.");
        }
      }}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-dashed bg-background px-3 font-mono text-sm font-semibold hover:bg-accent"
      aria-label={`Copy confirmation number ${code}`}
    >
      {copied ? <CheckIcon className="size-4 text-emerald-600" aria-hidden /> : <CopyIcon className="size-4 text-muted-foreground" aria-hidden />}
      {code}
    </button>
  );
}
