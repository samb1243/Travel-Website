import {
  BackpackIcon,
  BikeIcon,
  BuildingIcon,
  CarIcon,
  GlobeIcon,
  LandmarkIcon,
  Link2Icon,
  LockIcon,
  MountainIcon,
  PalmtreeIcon,
  PawPrintIcon,
  PlaneIcon,
  SnowflakeIcon,
  TrainFrontIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { TripType, Visibility } from "@/generated/prisma/enums";

/** Every trip type, in the order they're listed and stored. A trip can have several. */
export const TRIP_TYPES = [
  "BACKPACKING",
  "MULTI_CITY",
  "CITY_BREAK",
  "ROAD_TRIP",
  "RAIL",
  "HIKING",
  "CYCLING",
  "BEACH",
  "SNOW",
  "WILDLIFE",
  "FAMILY",
  "OTHER",
] as const satisfies readonly TripType[];

/** Most types a trip can have, so labels and filters stay meaningful. */
export const MAX_TRIP_TYPES = 4;

type TripTypeMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Flat landscape colour used when a trip has no cover photo */
  cover: string;
};

export const TRIP_TYPE_META: Record<TripType, TripTypeMeta> = {
  BACKPACKING: {
    label: "Backpacking",
    description: "Hostels, buses, a loose plan",
    icon: BackpackIcon,
    cover: "bg-[#2e6a86]", // lake
  },
  MULTI_CITY: {
    label: "Multi-city",
    description: "Several cities, linked by train or plane",
    icon: BuildingIcon,
    cover: "bg-[#4a566e]", // slate roofs
  },
  CITY_BREAK: {
    label: "City break",
    description: "A few days in one city",
    icon: LandmarkIcon,
    cover: "bg-[#5b5476]", // dusk over rooftops
  },
  ROAD_TRIP: {
    label: "Road trip",
    description: "Car, campervan or motorbike",
    icon: CarIcon,
    cover: "bg-[#7a5c45]", // desert road
  },
  RAIL: {
    label: "Rail journey",
    description: "Trains, rail passes, night trains",
    icon: TrainFrontIcon,
    cover: "bg-[#3d5a6b]", // steel
  },
  HIKING: {
    label: "Hiking",
    description: "Trails, huts and trailheads",
    icon: MountainIcon,
    cover: "bg-[#3f6b4f]", // alpine meadow
  },
  CYCLING: {
    label: "Cycling",
    description: "Bike touring and bikepacking",
    icon: BikeIcon,
    cover: "bg-[#4d6b3a]", // country lane
  },
  BEACH: {
    label: "Beach & islands",
    description: "Coasts, islands, ferries",
    icon: PalmtreeIcon,
    cover: "bg-[#23708a]", // sea
  },
  SNOW: {
    label: "Snow & skiing",
    description: "Ski resorts and winter trips",
    icon: SnowflakeIcon,
    cover: "bg-[#58738a]", // winter sky
  },
  WILDLIFE: {
    label: "Wildlife & safari",
    description: "National parks, safaris, wildlife",
    icon: PawPrintIcon,
    cover: "bg-[#6b6a3c]", // savannah
  },
  FAMILY: {
    label: "Family trip",
    description: "Travelling with children",
    icon: UsersIcon,
    cover: "bg-[#6a5a72]", // heather
  },
  OTHER: {
    label: "Other",
    description: "Anything else",
    icon: PlaneIcon,
    cover: "bg-[#5f6f69]", // granite
  },
};

/** De-duplicated, in TRIP_TYPES order, never empty (falls back to Other). */
export function normaliseTripTypes(types: readonly TripType[]): TripType[] {
  const set = new Set(types);
  const ordered = TRIP_TYPES.filter((t) => set.has(t));
  return ordered.length ? ordered : ["OTHER"];
}

/** The type that picks a trip's icon and fallback cover colour: its first one. */
export function primaryTripType(types: readonly TripType[]): TripType {
  return normaliseTripTypes(types)[0];
}

/** "Backpacking", "Backpacking & Multi-city", "Backpacking, Multi-city +2" */
export function formatTripTypes(types: readonly TripType[], max = 2): string {
  const labels = normaliseTripTypes(types).map((t) => TRIP_TYPE_META[t].label);
  if (labels.length === 2 && max >= 2) return `${labels[0]} & ${labels[1]}`;
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} +${labels.length - max}`;
}

export const VISIBILITY_META: Record<Visibility, { label: string; icon: LucideIcon; description: string }> = {
  PRIVATE: { label: "Private", icon: LockIcon, description: "Only you can see it" },
  UNLISTED: { label: "Unlisted", icon: Link2Icon, description: "Anyone with the link can view it" },
  PUBLIC: { label: "Public", icon: GlobeIcon, description: "Listed on Explore for anyone to copy" },
};
