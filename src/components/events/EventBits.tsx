import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, MapPin, Ticket, Users, Wifi } from "lucide-react";
import { Blob } from "@/components/doodle/Doodles";
import { categoryStyle, feeLabel, REGISTRATION_LABEL, registrationState, seatsLeft } from "@/lib/events/shared";
import { formatDay, formatTime, tzLabel } from "@/lib/events/time";
import type { EventItem, RegistrationState } from "@/lib/events/types";

export function CategoryChip({ category, className }: { category: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border-2 border-ink px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em]",
        categoryStyle(category).chip,
        className,
      )}
    >
      {category}
    </span>
  );
}

const STATE_CHIP: Record<RegistrationState, string> = {
  open: "bg-fr-softgreen",
  full: "bg-ink text-white",
  closed: "bg-white",
  not_open: "bg-fr-softblue",
  cancelled: "bg-fr-red text-white",
  past: "bg-white text-fr-muted",
};

export function StateChip({ state, className }: { state: RegistrationState; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full border-2 border-ink px-2.5 py-0.5 text-[12px] font-bold", STATE_CHIP[state], className)}>
      {REGISTRATION_LABEL[state]}
    </span>
  );
}

/** Poster / cover. Without an uploaded image it shows a brand-coloured placeholder (never a stock photo). */
export function EventCover({
  event,
  className,
  sizes = "(min-width: 1024px) 400px, 100vw",
  priority,
}: {
  event: Pick<EventItem, "coverUrl" | "title" | "category">;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const style = categoryStyle(event.category);
  return (
    <div className={clsx("relative overflow-hidden bg-fr-cream", className)}>
      {event.coverUrl ? (
        <Image src={event.coverUrl} alt={`${event.title} poster`} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-end p-5" aria-hidden>
          <Blob seed={event.title.length + 5} color={style.hex} className="absolute -right-10 -top-10 w-[75%]" />
          <Blob seed={event.title.length + 17} color="#FBBE18" wobble={0.35} className="absolute -bottom-8 left-[8%] w-[30%]" />
          <span className="relative font-hand text-4xl leading-none text-ink">{event.category}</span>
        </div>
      )}
    </div>
  );
}

export function EventCard({ event, now }: { event: EventItem; now: number }) {
  const state = registrationState(event, now);
  const left = seatsLeft(event);
  return (
    <article className="card-pop card-pop-hover group relative flex h-full flex-col overflow-hidden bg-white">
      <Link href={`/events/${event.slug}`} className="block" aria-label={event.title}>
        <EventCover event={event} className="aspect-[16/10] border-b-2 border-ink" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip category={event.category} />
          <span className="rounded-full border-2 border-ink bg-fr-yellow px-2.5 py-0.5 text-[12px] font-bold">{feeLabel(event.fee)}</span>
          {event.isFeatured && <span className="font-hand text-lg leading-none text-fr-blue">featured!</span>}
        </div>
        <h3 className={clsx("mt-3 font-display text-[1.35rem] font-bold leading-tight", event.status === "cancelled" && "line-through decoration-2")}>
          <Link href={`/events/${event.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {event.title}
          </Link>
        </h3>
        {event.summary && <p className="mt-2 line-clamp-2 text-[15px] text-fr-charcoal">{event.summary}</p>}
        <ul className="mt-4 space-y-1.5 text-[14px] text-ink">
          <li className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {formatDay(event.startsAt, event.timezone)} · {formatTime(event.startsAt, event.timezone)} {tzLabel(event.timezone)}
            </span>
          </li>
          <li className="flex items-start gap-2">
            {event.isOnline ? <Wifi className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            <span className="line-clamp-1">{[event.venue, event.location].filter(Boolean).join(", ") || (event.isOnline ? "Online" : "Venue TBA")}</span>
          </li>
          {left != null && state !== "past" && state !== "cancelled" && (
            <li className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{left > 0 ? `${left} of ${event.capacity} spots left` : "No spots left"}</span>
            </li>
          )}
        </ul>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <StateChip state={state} />
          {state === "open" ? (
            <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[14px] font-bold text-white transition group-hover:-rotate-1">
              <Ticket className="h-4 w-4" aria-hidden /> Register now
            </span>
          ) : (
            <span className="text-[14px] font-bold underline decoration-fr-yellow decoration-[3px] underline-offset-4">View details</span>
          )}
        </div>
      </div>
    </article>
  );
}

/** "All events · Calendar" switch shown on both public events pages. */
export function EventsTabs({ active }: { active: "list" | "calendar" }) {
  return (
    <nav className="inline-flex rounded-full border-2 border-ink bg-white p-1 shadow-pop-sm" aria-label="Events views">
      {[
        ["/events", "All events", "list"],
        ["/events/calendar", "Calendar", "calendar"],
      ].map(([href, label, key]) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? "page" : undefined}
          className={clsx("rounded-full px-5 py-2 text-[14px] font-bold transition", active === key ? "bg-ink text-white" : "hover:bg-fr-cream")}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
