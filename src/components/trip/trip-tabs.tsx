"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDaysIcon, CheckSquareIcon, LayoutListIcon, MapIcon, WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Overview", icon: LayoutListIcon },
  { segment: "itinerary", label: "Itinerary", icon: CalendarDaysIcon },
  { segment: "checklist", label: "Checklist", icon: CheckSquareIcon },
  { segment: "map", label: "Map", icon: MapIcon },
  { segment: "budget", label: "Budget", icon: WalletIcon },
];

/** Overview | Itinerary | Checklist | Map | Budget. Scrolls sideways on small phones. */
export function TripTabs({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Trip sections"
      className="sticky top-16 z-30 -mx-4 border-b bg-background/95 px-4 backdrop-blur"
    >
      <ul className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {TABS.map(({ segment, label, icon: Icon }) => {
          const href = segment ? `${basePath}/${segment}` : basePath;
          const active = pathname === href;
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center gap-2 border-b-4 px-3 text-[0.9375rem] font-bold whitespace-nowrap transition-colors",
                  active
                    ? "border-trail text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
