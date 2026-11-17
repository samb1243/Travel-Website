"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRightIcon, CheckIcon, CopyIcon, LockIcon } from "lucide-react";
import { CATEGORY_META, LINK_KIND_META, linkButtonLabel } from "@/lib/item-categories";
import { formatItemWhen } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Tappable } from "@/components/tappable";
import type { BuilderItem } from "@/server/trips";

export function ItemCard({
  item,
  currency,
  onEdit,
}: {
  item: BuilderItem;
  currency: string;
  /** Omit for read-only shared views */
  onEdit?: () => void;
}) {
  const meta = CATEGORY_META[item.category];
  const status = STATUS_META[item.status];
  const Icon = meta.icon;
  const when = formatItemWhen(item.startAt, item.endAt, item.allDay);
  const showRoute = item.fromPlace && item.toPlace && item.title !== `${item.fromPlace} → ${item.toPlace}`;

  return (
    <div className={cn("rounded-2xl border border-l-4 bg-card", status.border)}>
      <Tappable
        onClick={onEdit}
        label={`Edit ${item.title}`}
        className="flex w-full items-start gap-3 rounded-2xl p-3"
        interactiveClassName="hover:bg-accent/40"
      >
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-muted">
          <Icon className="size-4.5 text-muted-foreground" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-start justify-between gap-2">
            <span className="font-medium text-pretty">{item.title}</span>
            {item.cost !== null ? (
              <span className="shrink-0 text-sm font-medium tabular-nums">{formatMoney(item.cost, currency)}</span>
            ) : null}
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
          {item.notes ? <span className="line-clamp-3 block text-sm text-pretty whitespace-pre-line">{item.notes}</span> : null}
          <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", status.badge)}>
            <span aria-hidden>{status.emoji}</span> {status.label}
          </span>
        </span>
      </Tappable>

      {item.links.length || item.confirmationCode ? (
        <div className="flex flex-wrap gap-2 px-3 pb-3">
          {item.confirmationCode ? <CopyCode code={item.confirmationCode} /> : null}
          {item.links.map((l) => {
            const LinkIcon = LINK_KIND_META[l.kind].icon;
            return (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border bg-background px-3.5 text-sm font-medium hover:bg-accent"
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
      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed bg-background px-3.5 font-mono text-sm hover:bg-accent"
      aria-label={`Copy confirmation number ${code}`}
    >
      {copied ? <CheckIcon className="size-4 text-emerald-600" aria-hidden /> : <CopyIcon className="size-4 text-muted-foreground" aria-hidden />}
      {code}
    </button>
  );
}
