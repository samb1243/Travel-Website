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
    <nav className="hidden items-stretch gap-1 self-stretch md:flex" aria-label="Main">
      {NAV_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            // The current section is marked like a trail blaze: a yellow bar under it.
            "relative flex h-16 items-center px-3 text-[0.9375rem] font-semibold text-muted-foreground transition-colors hover:text-foreground",
            "after:absolute after:inset-x-3 after:bottom-0 after:h-1 after:rounded-t-full after:bg-transparent",
            isActive(pathname, href) && "text-foreground after:bg-trail",
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
      className="fixed inset-x-0 bottom-0 z-40 bg-[#1c3a32] pb-[env(safe-area-inset-bottom)] text-[#e6eeea] md:hidden dark:border-t dark:bg-card"
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
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-[#e6eeea]/70",
                  active && "text-[#e6eeea]",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active && "bg-trail text-trail-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
