import {
  BuildingIcon,
  GlobeIcon,
  Link2Icon,
  LockIcon,
  MountainIcon,
  PalmtreeIcon,
  PlaneIcon,
  type LucideIcon,
} from "lucide-react";
import type { TripType, Visibility } from "@/generated/prisma/enums";

export const TRIP_TYPES = ["BACKPACKING", "MULTI_CITY", "HIKING", "OTHER"] as const satisfies readonly TripType[];

type TripTypeMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Golden-hour gradient used when a trip has no cover photo */
  cover: string;
};

export const TRIP_TYPE_META: Record<TripType, TripTypeMeta> = {
  BACKPACKING: {
    label: "Backpacking",
    description: "Hostels, buses, a loose plan",
    icon: PalmtreeIcon,
    cover: "from-[#f6c27a] via-[#e98b6d] to-[#3f7f86]",
  },
  MULTI_CITY: {
    label: "Multi-city",
    description: "Cities linked by train or plane",
    icon: BuildingIcon,
    cover: "from-[#f3c58f] via-[#c9787f] to-[#4a4e7c]",
  },
  HIKING: {
    label: "Hiking",
    description: "Trails, huts and trailheads",
    icon: MountainIcon,
    cover: "from-[#a9cbe0] via-[#c9d7a7] to-[#5f8a5a]",
  },
  OTHER: {
    label: "Other",
    description: "Anything else",
    icon: PlaneIcon,
    cover: "from-[#fbd88f] via-[#d9826a] to-[#2f3d63]",
  },
};

export const VISIBILITY_META: Record<Visibility, { label: string; icon: LucideIcon; description: string }> = {
  PRIVATE: { label: "Private", icon: LockIcon, description: "Only you can see it" },
  UNLISTED: { label: "Unlisted", icon: Link2Icon, description: "Anyone with the link can view it" },
  PUBLIC: { label: "Public", icon: GlobeIcon, description: "Listed on Explore for anyone to copy" },
};
