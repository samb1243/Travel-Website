import Link from "next/link";
import { CheckCircle2Icon, CopyIcon, MapIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WindowView } from "@/components/window-view";

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
      <section className="grid items-center gap-10 pt-4 md:grid-cols-[1fr_280px] md:pt-10">
        <div className="space-y-6">
          <h1 className="max-w-2xl font-heading text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Every trip, in one place.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-pretty">
            Plan backpacking routes, multi-city trips and hikes. Keep every booking link and
            confirmation handy while you travel, then share the trip so others can copy it.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/signup">Plan a trip</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link href="/explore">Explore trips</Link>
            </Button>
          </div>
        </div>
        <WindowView className="mx-auto hidden max-w-[280px] drop-shadow-xl md:block" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border bg-card p-5">
            <Icon className="mb-3 size-6 text-primary" aria-hidden />
            <h2 className="font-heading font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
