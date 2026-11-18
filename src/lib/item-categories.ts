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
  /** end: always shown, hidden behind "Add end time" ("optional"), or not used */
  fields: { route: boolean; end: boolean | "optional" };
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
    fields: { route: false, end: "optional" },
    labels: { title: "What", provider: "Operator", start: "Starts", end: "Ends", titlePlaceholder: "e.g. Cooking class" },
  },
  FOOD: {
    label: "Food",
    icon: UtensilsIcon,
    fields: { route: false, end: "optional" },
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

// --- Colour groups ----------------------------------------------------------------
// What kind of thing an item is, as a colour on its icon. The colours are CSS
// variables (src/lib/colors.ts) that people can change; the defaults stay clear
// of the status colours and of trail yellow, which is reserved for the route.

export const ITEM_GROUPS = ["TRAVEL", "STAY", "DO", "KIT"] as const;
export type ItemGroup = (typeof ITEM_GROUPS)[number];

export const GROUP_META: Record<ItemGroup, { label: string; tile: string; text: string }> = {
  TRAVEL: { label: "Getting around", tile: "bg-(--k-travel) text-(--k-travel-fg)", text: "text-(--k-travel-ink)" },
  STAY: { label: "Places to stay", tile: "bg-(--k-stay) text-(--k-stay-fg)", text: "text-(--k-stay-ink)" },
  DO: { label: "Things to do", tile: "bg-(--k-do) text-(--k-do-fg)", text: "text-(--k-do-ink)" },
  KIT: { label: "Gear & admin", tile: "bg-(--k-kit) text-(--k-kit-fg)", text: "text-(--k-kit-ink)" },
};

const CATEGORY_GROUP: Record<ItemCategory, ItemGroup> = {
  FLIGHT: "TRAVEL",
  TRANSPORT: "TRAVEL",
  ACCOMMODATION: "STAY",
  ACTIVITY: "DO",
  FOOD: "DO",
  GEAR: "KIT",
  OTHER: "KIT",
};

export function itemGroup(category: ItemCategory): ItemGroup {
  return CATEGORY_GROUP[category];
}

/** Whether an item passes a group filter. No groups picked means "show everything". */
export function inGroups(category: ItemCategory, groups: readonly ItemGroup[]): boolean {
  return groups.length === 0 || groups.includes(itemGroup(category));
}

/** How many items fall in each group, for the counts on the filter. */
export function countByGroup(items: readonly { category: ItemCategory }[]): Record<ItemGroup, number> {
  const counts: Record<ItemGroup, number> = { TRAVEL: 0, STAY: 0, DO: 0, KIT: 0 };
  for (const i of items) counts[itemGroup(i.category)]++;
  return counts;
}
