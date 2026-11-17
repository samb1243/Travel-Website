"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "@/components/nav-links";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The pathname is request data, so the highlighted versions render inside
// <Suspense>; the fallback is the same nav with nothing highlighted.

/** Inline links in the top header, shown from tablet width up. */
export function DesktopNav() {
  return (
    <Suspense fallback={<DesktopNavLinks pathname="" />}>
      <DesktopNavWithPath />
    </Suspense>
  );
}

function DesktopNavWithPath() {
  return <DesktopNavLinks pathname={usePathname()} />;
}

function DesktopNavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {NAV_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            isActive(pathname, href) && "bg-accent text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Thumb-friendly tab bar fixed to the bottom of the screen on phones. */
export function MobileTabBar() {
  return (
    <Suspense fallback={<MobileTabBarLinks pathname="" />}>
      <MobileTabBarWithPath />
    </Suspense>
  );
}

function MobileTabBarWithPath() {
  return <MobileTabBarLinks pathname={usePathname()} />;
}

function MobileTabBarLinks({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-3">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
                  active && "text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
