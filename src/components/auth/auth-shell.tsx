import type { ReactNode } from "react";
import { Signpost } from "@/components/signpost";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-4xl items-center gap-10 md:grid-cols-[1fr_minmax(0,360px)] md:py-6">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl leading-none font-black tracking-[-0.02em]">{title}</h1>
          {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
      </div>
      <div className="hidden md:block">
        <Signpost />
      </div>
    </div>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-12 animate-pulse rounded-lg bg-muted" />
      <div className="h-12 animate-pulse rounded-lg bg-muted" />
      <div className="h-12 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
