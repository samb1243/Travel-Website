import Link from "next/link";
import { CheckCircle2Icon, CopyIcon, MapIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ITEM_STATUSES, STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: MapIcon,
    title: "Your whole route",
    text: "Stops, flights, hostels, buses and hikes, in order and on a map.",
  },
  {
    icon: CheckCircle2Icon,
    title: "Know what's booked",
    text: "One checklist shows what's booked, what you pay on arrival and what's still to book.",
  },
  {
    icon: WalletIcon,
    title: "Stay on budget",
    text: "See spend by category, by stop and per day, as you plan.",
  },
  {
    icon: CopyIcon,
    title: "Copy great trips",
    text: "Find a public trip you like, copy it in one tap and make it yours.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-6 pt-4 md:pt-10">
        <h1 className="max-w-2xl font-heading text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Every trip, in one place.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground text-pretty">
          Plan backpacking routes, multi-city trips and hikes. Keep every booking link and
          confirmation handy while you travel, then share the trip so others can copy it.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link href="/dashboard">Plan a trip</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
            <Link href="/explore">Explore trips</Link>
          </Button>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Booking statuses">
          {ITEM_STATUSES.map((s) => (
            <li
              key={s}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium",
                STATUS_META[s].badge,
              )}
            >
              <span aria-hidden>{STATUS_META[s].emoji}</span> {STATUS_META[s].label}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border bg-card p-5">
            <Icon className="mb-3 size-6 text-muted-foreground" aria-hidden />
            <h2 className="font-heading font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
