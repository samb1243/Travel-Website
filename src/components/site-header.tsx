import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { DesktopNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/session";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8 self-stretch">
          <Logo />
          <DesktopNav />
        </div>
        <div className="flex items-center gap-1">
          {/* Reads the session, so it streams in without blocking the page.
              Signed-in users pick a theme from their profile menu. */}
          <Suspense fallback={<div className="size-10" />}>
            <HeaderAccount />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function HeaderAccount() {
  const user = await getCurrentUser();
  if (user) return <AccountMenu user={user} />;
  return (
    <>
      <ThemeToggle />
      <Button asChild variant="ghost" className="h-10 px-3">
        <Link href="/login">Log in</Link>
      </Button>
    </>
  );
}
