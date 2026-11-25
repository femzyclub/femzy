import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, CalendarDays, MapPin, Wifi } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow, Blob, MarkerUnderline, Sticker } from "@/components/doodle/Doodles";
import { categoryStyle, feeLabel } from "@/lib/events/shared";
import { formatTime, tzLabel } from "@/lib/events/time";
import type { EventItem } from "@/lib/events/types";

const dayNum = (iso: string, tz: string) => new Intl.DateTimeFormat("en-IN", { timeZone: tz, day: "numeric" }).format(new Date(iso));
const monthShort = (iso: string, tz: string) => new Intl.DateTimeFormat("en-IN", { timeZone: tz, month: "short" }).format(new Date(iso));
const weekday = (iso: string, tz: string) => new Intl.DateTimeFormat("en-IN", { timeZone: tz, weekday: "short" }).format(new Date(iso));

/** Home hero: promise on the left, a fanned stack of the next upcoming events on the right. */
export function Hero({ upcoming, upcomingCount }: { upcoming: EventItem[]; upcomingCount: number }) {
  const stack = upcoming.slice(0, 3);
  const tilts = ["-rotate-[4deg]", "rotate-[3deg]", "-rotate-[1.5deg]"];
  const offsets = ["lg:translate-x-6", "lg:-translate-x-4", "lg:translate-x-10"];

  return (
    <section className="relative overflow-hidden bg-fr-warm pb-20 pt-32 lg:pb-28 lg:pt-40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(251,190,24,0.2),transparent_25%),radial-gradient(circle_at_18%_78%,rgba(98,185,70,0.1),transparent_28%)]" aria-hidden />
      <Blob seed={3} color="#FBBE18" className="absolute -right-40 -top-24 w-[640px] opacity-95 lg:-right-20" />
      <Blob seed={21} color="#62B946" wobble={0.35} className="absolute bottom-10 left-[44%] hidden w-24 lg:block" />
      <Blob seed={11} color="#1748E8" wobble={0.35} className="absolute -left-10 top-40 hidden w-20 sm:block" />

      <div className="container-x relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div className="relative z-10 min-w-0">
          <span className="eyebrow">Femzy · events for women who play</span>
          <h1 className="h-display mt-6 text-[3.4rem] sm:text-7xl lg:text-[5.6rem]">
            Find your{" "}
            <span className="relative inline-block">
              game.
              <MarkerUnderline className="absolute -bottom-2 left-0 h-4 w-full" />
            </span>
            <br />
            <span className="font-hand font-normal text-fr-blue">Find your people!</span>
          </h1>
          <p className="mt-7 max-w-md text-[17px] leading-relaxed text-fr-charcoal">
            Runs, tournaments, workshops and meetups — all in one place. Pick an event, <b>register online in a minute</b>, and show up to play with
            women who love the game as much as you do.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <ButtonLink href="/events" burst>
              Explore events
            </ButtonLink>
            <ButtonLink href="/events/calendar" variant="outline">
              <CalendarDays className="h-5 w-5" /> View calendar
            </ButtonLink>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Sticker color="#E5F4DF" rotate={-4}>
              {upcomingCount > 0 ? `${upcomingCount} upcoming event${upcomingCount === 1 ? "" : "s"}` : "new events soon"}
            </Sticker>
            <Sticker color="#DCE8FF" rotate={3}>
              any sport · every level
            </Sticker>
          </div>
        </div>

        <div className="relative mx-auto w-full min-w-0 max-w-[460px] lg:mx-0 lg:justify-self-end">
          <Arrow variant="loop" className="absolute -left-16 -top-6 hidden h-16 w-24 -rotate-12 lg:block" />
          <p className="mb-4 font-hand text-3xl text-ink">coming up next →</p>
          {stack.length === 0 ? (
            <div className="card-pop -rotate-2 bg-white p-8 text-center">
              <p className="h-display text-3xl">New events coming soon</p>
              <p className="mt-2 text-[15px] text-fr-charcoal">Check the calendar — they&apos;ll show up here the moment they&apos;re announced.</p>
            </div>
          ) : (
            <ol className="relative -space-y-1">
              {stack.map((e, i) => {
                const place = [e.venue, e.location].filter(Boolean).join(", ") || (e.isOnline ? "Online" : "Venue TBA");
                return (
                  <li key={e.id} className={clsx("relative transition-transform duration-300 hover:z-20 hover:rotate-0", tilts[i], offsets[i])} style={{ zIndex: 10 - i }}>
                    <Link href={`/events/${e.slug}`} className="card-pop group flex items-stretch overflow-hidden bg-white hover:shadow-pop-lg">
                      <span
                        className="flex w-[92px] shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-ink py-4"
                        style={{ background: categoryStyle(e.category).hex }}
                      >
                        <span className={clsx("text-[12px] font-bold uppercase tracking-[0.14em]", e.category === "Workshop" && "text-white")}>{monthShort(e.startsAt, e.timezone)}</span>
                        <span className={clsx("h-display text-5xl leading-none", e.category === "Workshop" && "text-white")}>{dayNum(e.startsAt, e.timezone)}</span>
                        <span className={clsx("text-[12px] font-bold", e.category === "Workshop" && "text-white")}>{weekday(e.startsAt, e.timezone)}</span>
                      </span>
                      <span className="min-w-0 flex-1 p-4">
                        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fr-muted">
                          {e.category} · {feeLabel(e.fee)}
                        </span>
                        <span className="mt-1 block font-display text-lg font-bold leading-tight">{e.title}</span>
                        <span className="mt-2 flex items-center gap-1.5 text-[13px] text-fr-charcoal">
                          {e.isOnline ? <Wifi className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">
                            {formatTime(e.startsAt, e.timezone)} {tzLabel(e.timezone)} · {place}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-start p-3">
                        <ArrowUpRight className="h-5 w-5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
