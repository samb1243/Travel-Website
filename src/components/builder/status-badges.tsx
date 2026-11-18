import { MapIcon, ReceiptIcon } from "lucide-react";
import { mapLinksFor } from "@/lib/map-links";
import { PAYMENT_META, STATUS_META, type ItemStatus, type PaymentStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

const chip = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium";

/** Booking (or buying) status and payment status, as two chips. */
export function StatusBadges({
  status,
  payment,
  only,
  className,
}: {
  status: ItemStatus | null;
  payment: PaymentStatus | null;
  /** Only show statuses that still need something doing */
  only?: "open";
  className?: string;
}) {
  const showStatus = status && (!only || status === "TO_BOOK" || status === "TO_BUY");
  const showPayment = payment && (!only || payment !== "PAID");
  if (!showStatus && !showPayment) return null;
  return (
    <span className={cn("mt-1 flex flex-wrap gap-1.5", className)}>
      {showStatus ? (
        <span className={cn(chip, STATUS_META[status].badge)}>
          <span aria-hidden>{STATUS_META[status].emoji}</span> {STATUS_META[status].label}
        </span>
      ) : null}
      {showPayment ? (
        <span className={cn(chip, PAYMENT_META[payment].badge)}>
          <span aria-hidden>{PAYMENT_META[payment].emoji}</span> {PAYMENT_META[payment].label}
        </span>
      ) : null}
    </span>
  );
}

/** On a copied trip: the original had a confirmation, so remind this traveller to add theirs. */
export function AddConfirmationChip({ onClick, className }: { onClick?: () => void; className?: string }) {
  const content = (
    <>
      <ReceiptIcon className="size-3.5" aria-hidden /> Add your confirmation
    </>
  );
  const cls = cn(chip, "border-dashed border-foreground/30 bg-background text-foreground", className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "hover:bg-accent")}>
      {content}
    </button>
  ) : (
    <span className={cls}>{content}</span>
  );
}

/** "Google Maps" / "Apple Maps" buttons for an item's address or route. */
export function MapLinks({
  item,
  className,
}: {
  item: { address: string | null; fromPlace: string | null; toPlace: string | null; title: string };
  className?: string;
}) {
  const links = mapLinksFor(item);
  if (!links.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-2", className)}>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-semibold hover:bg-accent"
        >
          <MapIcon className="size-4 text-muted-foreground" aria-hidden />
          {l.label}
        </a>
      ))}
    </span>
  );
}
