import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import { SectionHead } from "@/components/ui/SectionHead";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { categoryStyle } from "@/lib/events/shared";
import { EVENT_CATEGORIES, type EventItem } from "@/lib/events/types";

const BLURB: Record<string, string> = {
  Sports: "Runs, rides, swims and pick-up games.",
  Tournament: "Friendly competition with a trophy at the end.",
  Workshop: "Learn a skill from coaches and pros.",
  Wellness: "Recovery, breathwork and mobility.",
  Meetup: "Coffee, chats and new teammates.",
  Webinar: "Live online sessions from anywhere.",
  Other: "Everything else we get up to.",
};
const TILT = ["-rotate-1", "rotate-1", "-rotate-[0.5deg]", "rotate-[1.5deg]", "-rotate-[1.5deg]", "rotate-[0.5deg]", "-rotate-1"];

/** "What we play" — one tile per category, each opening the events list filtered to it. */
export function CategoriesSection({ events, now }: { events: EventItem[]; now: number }) {
  const counts = new Map<string, number>();
  for (const e of events) if (e.status === "published" && new Date(e.endsAt).getTime() >= now) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);

  return (
    <section id="categories" className="relative scroll-mt-24 border-y-2 border-ink bg-fr-cream py-24 lg:py-32">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHead eyebrow="What we play" title={<>Something for<br />every kind of player</>} />
          <p className="max-w-xs font-hand text-3xl leading-tight text-fr-blue lg:text-right">first-timer or seasoned pro — come as you are</p>
        </div>
        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {EVENT_CATEGORIES.map((c, i) => {
            const n = counts.get(c) ?? 0;
            const dark = c === "Workshop";
            return (
              <StaggerItem key={c} className={clsx(i === 0 && "lg:col-span-2")}>
                <Link
                  href={`/events?category=${encodeURIComponent(c)}`}
                  className={clsx("card-pop card-pop-hover group flex h-full min-h-[170px] flex-col justify-between p-5", TILT[i], categoryStyle(c).chip)}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="h-display text-3xl">{c === "Other" ? "& more" : c}</span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white text-ink transition group-hover:rotate-45">
                      <ArrowUpRight className="h-5 w-5" />
                    </span>
                  </span>
                  <span>
                    <span className={clsx("block text-[15px]", dark ? "text-white/90" : "text-fr-charcoal")}>{BLURB[c]}</span>
                    <span className="mt-2 block text-[12px] font-bold uppercase tracking-[0.12em]">{n > 0 ? `${n} upcoming` : "See events"}</span>
                  </span>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
