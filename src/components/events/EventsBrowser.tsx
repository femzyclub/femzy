"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { EventCard } from "@/components/events/EventBits";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { categoryStyle } from "@/lib/events/shared";
import { EVENT_CATEGORIES, type EventItem } from "@/lib/events/types";

/** Search + category filter over Featured / Upcoming / Past. Filtering is instant (no reload). */
export function EventsBrowser({ events, now, initialCategory = null }: { events: EventItem[]; now: number; initialCategory?: string | null }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(initialCategory);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter(
      (e) =>
        (!cat || e.category === cat) &&
        (!needle || [e.title, e.summary, e.venue, e.location, e.category].filter(Boolean).join(" ").toLowerCase().includes(needle)),
    );
  }, [events, q, cat]);

  const upcoming = filtered.filter((e) => new Date(e.endsAt).getTime() >= now);
  const past = filtered.filter((e) => new Date(e.endsAt).getTime() < now).reverse();
  const featured = upcoming.filter((e) => e.isFeatured && e.status === "published");
  const present = new Set(events.map((e) => e.category));
  const filtering = Boolean(q.trim() || cat);

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-md">
          <span className="sr-only">Search events</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fr-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, venues, cities…" className="field !pl-11" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-fr-cream">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
          <FilterChip active={!cat} onClick={() => setCat(null)}>
            All
          </FilterChip>
          {EVENT_CATEGORIES.filter((c) => present.has(c) || c === cat).map((c) => (
            <FilterChip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)} dot={categoryStyle(c).hex}>
              {c}
            </FilterChip>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <Empty title="No events yet" body="New Femrise events will show up here as soon as they're announced. Check back soon!" />
      ) : filtered.length === 0 ? (
        <Empty title="Nothing matches that" body="Try a different search or clear the category filter." />
      ) : (
        <>
          {!filtering && featured.length > 0 && (
            <Section title="Featured" hand="don't miss these!">
              <Grid events={featured} now={now} />
            </Section>
          )}
          <Section title={filtering ? "Matching upcoming events" : "Upcoming events"} count={upcoming.length}>
            {upcoming.length ? (
              <Grid events={upcoming} now={now} />
            ) : (
              <p className="card-pop bg-white p-6 text-center font-bold">No upcoming events {filtering ? "match" : "right now"} — check the past events below.</p>
            )}
          </Section>
          {past.length > 0 && (
            <Section title="Past events" count={past.length}>
              <Grid events={past} now={now} muted />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children, dot }: { active: boolean; onClick: () => void; children: React.ReactNode; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-[14px] font-bold transition",
        active ? "bg-ink text-white" : "bg-white hover:bg-fr-cream",
      )}
    >
      {dot && <span className="h-2.5 w-2.5 rounded-full border border-ink" style={{ background: dot }} aria-hidden />}
      {children}
    </button>
  );
}

function Section({ title, hand, count, children }: { title: string; hand?: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <div className="mb-6 flex items-baseline gap-3">
        <h2 className="h-display text-3xl sm:text-4xl">{title}</h2>
        {hand && <span className="font-hand text-2xl text-fr-blue">{hand}</span>}
        {count != null && <span className="text-[14px] font-bold text-fr-muted">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Grid({ events, now, muted }: { events: EventItem[]; now: number; muted?: boolean }) {
  return (
    <Stagger className={clsx("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", muted && "opacity-90")}>
      {events.map((e) => (
        <StaggerItem key={e.id} className="h-full">
          <EventCard event={e} now={now} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="card-pop mt-12 bg-white p-10 text-center">
      <p className="h-display text-3xl">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-[15px] text-fr-charcoal">{body}</p>
    </div>
  );
}
