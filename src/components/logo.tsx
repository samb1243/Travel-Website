import Link from "next/link";
import { LayersIcon } from "lucide-react";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md font-heading text-lg font-semibold tracking-tight"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <LayersIcon className="size-4.5" aria-hidden />
      </span>
      TripStack
    </Link>
  );
}
