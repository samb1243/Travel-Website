import Link from "next/link";
import { CheckCircle2Icon, CopyIcon, MapIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Signpost } from "@/components/signpost";

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
    <div className="space-y-16 md:space-y-24">
      <section className="grid items-center gap-8 pt-2 md:grid-cols-[1.15fr_1fr] md:gap-12 md:pt-12">
        <div className="space-y-7">
          <h1 className="font-heading text-[2.875rem] leading-[0.95] font-black tracking-[-0.025em] text-balance sm:text-6xl md:text-7xl">
            Every trip, in one place.
          </h1>
          <p className="max-w-[34rem] text-lg leading-relaxed text-pretty text-muted-foreground">
            Plan backpacking routes, multi-city trips and hikes. Keep every booking link and
            confirmation handy while you travel, then share the trip so others can copy it.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-xl px-7 text-base font-bold">
              <Link href="/signup">Plan a trip</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-2 px-7 text-base font-bold">
              <Link href="/explore">Explore trips</Link>
            </Button>
          </div>
        </div>
        <Signpost className="max-w-sm md:max-w-md" />
      </section>

      <section className="grid gap-x-12 gap-y-10 border-t-4 border-foreground pt-10 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="grid grid-cols-[auto_1fr] gap-x-4">
            <span className="grid size-11 place-items-center rounded-xl bg-foreground text-background">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-heading text-xl font-extrabold">{title}</h2>
              <p className="mt-1 max-w-[36ch] text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
