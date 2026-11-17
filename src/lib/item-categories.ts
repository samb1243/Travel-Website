import {
  BedDoubleIcon,
  BusIcon,
  CompassIcon,
  ExternalLinkIcon,
  InfoIcon,
  MapPinnedIcon,
  PackageIcon,
  PlaneIcon,
  ReceiptIcon,
  TicketIcon,
  UtensilsIcon,
  type LucideIcon,
} from "lucide-react";
import type { ItemCategory, LinkKind } from "@/generated/prisma/enums";

export const ITEM_CATEGORIES = [
  "FLIGHT",
  "ACCOMMODATION",
  "TRANSPORT",
  "ACTIVITY",
  "FOOD",
  "GEAR",
  "OTHER",
] as const satisfies readonly ItemCategory[];

type CategoryMeta = {
  label: string;
  icon: LucideIcon;
  /** Which form fields make sense for this kind of item */
  fields: { route: boolean; end: boolean };
  labels: { title: string; provider: string; start: string; end: string; titlePlaceholder: string };
};

export const CATEGORY_META: Record<ItemCategory, CategoryMeta> = {
  FLIGHT: {
    label: "Flight",
    icon: PlaneIcon,
    fields: { route: true, end: true },
    labels: { title: "Name (optional)", provider: "Airline", start: "Departs", end: "Arrives", titlePlaceholder: "e.g. TG 917" },
  },
  ACCOMMODATION: {
    label: "Stay",
    icon: BedDoubleIcon,
    fields: { route: false, end: true },
    labels: { title: "Where you're staying", provider: "Booked via", start: "Check-in", end: "Check-out", titlePlaceholder: "e.g. Riverside hostel, 6-bed dorm" },
  },
  TRANSPORT: {
    label: "Bus / train",
    icon: BusIcon,
    fields: { route: true, end: true },
    labels: { title: "Name (optional)", provider: "Operator", start: "Departs", end: "Arrives", titlePlaceholder: "e.g. Overnight sleeper train" },
  },
  ACTIVITY: {
    label: "Activity",
    icon: CompassIcon,
    fields: { route: false, end: true },
    labels: { title: "What", provider: "Operator", start: "Starts", end: "Ends", titlePlaceholder: "e.g. Cooking class" },
  },
  FOOD: {
    label: "Food",
    icon: UtensilsIcon,
    fields: { route: false, end: false },
    labels: { title: "What", provider: "Place", start: "When", end: "Until", titlePlaceholder: "e.g. Street food tour" },
  },
  GEAR: {
    label: "Gear",
    icon: PackageIcon,
    fields: { route: false, end: false },
    labels: { title: "What", provider: "Shop", start: "Buy by", end: "Until", titlePlaceholder: "e.g. Rain jacket" },
  },
  OTHER: {
    label: "Other",
    icon: ReceiptIcon,
    fields: { route: false, end: false },
    labels: { title: "What", provider: "Provider", start: "Date", end: "Until", titlePlaceholder: "e.g. Travel insurance, visa" },
  },
};

export const LINK_KINDS = ["BOOKING", "CONFIRMATION", "MAP", "INFO", "OTHER"] as const satisfies readonly LinkKind[];

export const LINK_KIND_META: Record<LinkKind, { label: string; icon: LucideIcon; hint?: string }> = {
  BOOKING: { label: "Booking", icon: TicketIcon },
  CONFIRMATION: { label: "Confirmation", icon: ReceiptIcon, hint: "Private: never shown on shared trips or copied" },
  MAP: { label: "Map", icon: MapPinnedIcon },
  INFO: { label: "Info", icon: InfoIcon },
  OTHER: { label: "Link", icon: ExternalLinkIcon },
};

/** Text for a link button: its label, else the kind, else the website name. */
export function linkButtonLabel(link: { kind: LinkKind; label: string | null; url: string }) {
  if (link.label) return link.label;
  if (link.kind !== "OTHER") return LINK_KIND_META[link.kind].label;
  try {
    return new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}
