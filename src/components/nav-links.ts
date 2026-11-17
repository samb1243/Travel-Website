import { CompassIcon, LuggageIcon, UserIcon, type LucideIcon } from "lucide-react";

export type NavLink = { href: string; label: string; icon: LucideIcon };

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "My trips", icon: LuggageIcon },
  { href: "/explore", label: "Explore", icon: CompassIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];
