"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, List, Loader2, MapPin, Wifi } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { categoryStyle, feeLabel } from "@/lib/events/shared";
import { eventDateKeys, formatTime, tzLabel } from "@/lib/events/time";
import { EVENT_CATEGORIES, type CalendarEvent } from "@/lib/events/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");
const parseMonth = (s: string) => s.split("-").map(Number) as [number, number];
const shiftMonth = (s: string, delta: number) => {
  const [y, m] = parseMonth(s);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
const longDate = (key: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));

/**
 * Monthly events calendar. Everything comes from the database through /api/events —
 * nothing is hard-coded. It re-fetches when the month changes and whenever the tab
 * regains focus, so admin changes show up without a reload.
 */
export function EventsCalendar({ initialMonth, today, initialEvents }: { initialMonth: string; today: string; initialEvents: CalendarEvent[] }) {
  const [month, setMonth] = useState(initialMonth);
  const [view, setView] = useState<"month" | "list">("month");
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(today.startsWith(initialMonth) ? today : null);
  const reqId = useRef(0);
  const first = useRef(true);

  const load = useCallback(async (m: string, quiet = false) => {
    const id = ++reqId.current;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events?month=${m}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { events: CalendarEvent[] };
      if (id === reqId.current) setEvents(json.events);
    } catch {
      if (id === reqId.current) setError("Couldn't load events. Check your connection and try again.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    load(month);
  }, [month, load]);

  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && load(month, true);
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [month, load]);

  const [year, mon] = parseMonth(month);
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const lead = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();

  // date key → events on that day (multi-day events appear on every day they cover)
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      for (const k of eventDateKeys(e.startsAt, e.endsAt, e.timezone)) {
        if (!k.startsWith(month)) continue;
        map.set(k, [...(map.get(k) ?? []), e]);
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [events, month]);

  const go = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(today.startsWith(next) ? today : null);
  };
  const goToday = () => {
    setMonth(today.slice(0, 7));
    setSelected(today);
  };

  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);

  const listDays = Array.from(byDay.keys()).sort();
  const selectedEvents = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(-1)} aria-label="Previous month" className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white shadow-pop-sm transition hover:-translate-y-0.5">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="h-display min-w-[11ch] text-center text-3xl sm:text-4xl" aria-live="polite">
            {MONTHS[mon - 1]} <span className="text-fr-muted">{year}</span>
          </h2>
          <button type="button" onClick={() => go(1)} aria-label="Next month" className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white shadow-pop-sm transition hover:-translate-y-0.5">
            <ChevronRight className="h-5 w-5" />
          </button>
          {!today.startsWith(month) && (
            <button type="button" onClick={goToday} className="ml-1 rounded-full border-2 border-ink bg-fr-yellow px-4 py-2 text-[14px] font-bold">
              Today
            </button>
          )}
          {loading && <Loader2 className="ml-1 h-5 w-5 animate-spin" aria-label="Loading" />}
        </div>
        <div className="inline-flex self-start rounded-full border-2 border-ink bg-white p-1 sm:self-auto" role="group" aria-label="Calendar view">
          {(
            [
              ["month", "Month", CalendarDays],
              ["list", "List", List],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={clsx("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-bold", view === k ? "bg-ink text-white" : "hover:bg-fr-cream")}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-bold" aria-label="Category colours">
        {EVENT_CATEGORIES.map((c) => (
          <li key={c} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-ink" style={{ background: categoryStyle(c).hex }} aria-hidden /> {c}
          </li>
        ))}
      </ul>

      {error && (
        <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border-2 border-fr-red bg-white p-4 font-bold text-fr-red">
          {error}
          <button type="button" onClick={() => load(month)} className="btn-outline !py-2 text-[14px] text-ink">
            Try again
          </button>
        </div>
      )}

      {view === "month" ? (
        <>
          <div className={clsx("card-pop mt-6 overflow-hidden bg-white transition-opacity", loading && "opacity-60")}>
            <div className="grid grid-cols-7 border-b-2 border-ink bg-fr-cream">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] sm:text-[12px]">
                  <span className="sm:hidden">{d[0]}</span>
                  <span className="hidden sm:inline">{d}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((key, i) => {
                const list = key ? byDay.get(key) ?? [] : [];
                const isToday = key === today;
                const isSel = key === selected;
                return (
                  <div
                    key={key ?? `blank-${i}`}
                    onClick={key ? () => setSelected(key) : undefined}
                    className={clsx(
                      "relative min-h-[64px] border-ink/15 p-1 sm:min-h-[122px] sm:p-2",
                      i % 7 !== 6 && "border-r",
                      i < cells.length - 7 && "border-b",
                      key ? "cursor-pointer hover:bg-fr-warm" : "bg-fr-warm/60",
                      isSel && "!bg-fr-cream",
                    )}
                  >
                    {key && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(key);
                          }}
                          aria-label={`${longDate(key)}: ${list.length} event${list.length === 1 ? "" : "s"}`}
                          aria-pressed={isSel}
                          className={clsx(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold sm:h-8 sm:w-8 sm:text-[14px]",
                            isToday ? "border-2 border-ink bg-fr-yellow" : isSel ? "bg-ink text-white" : "hover:bg-fr-cream",
                          )}
                        >
                          {Number(key.slice(8))}
                        </button>
                        {/* phones: dots */}
                        {list.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1 px-0.5 sm:hidden" aria-hidden>
                            {list.slice(0, 4).map((e) => (
                              <span key={e.id} className="h-2 w-2 rounded-full border border-ink" style={{ background: categoryStyle(e.category).hex }} />
                            ))}
                          </div>
                        )}
                        {/* tablet / desktop: names */}
                        <ul className="mt-1 hidden space-y-1 sm:block">
                          {list.slice(0, 3).map((e) => (
                            <li key={e.id}>
                              <Link
                                href={`/events/${e.slug}`}
                                onClick={(ev) => ev.stopPropagation()}
                                title={`${e.title} · ${formatTime(e.startsAt, e.timezone)}`}
                                className={clsx(
                                  "block truncate rounded-[6px] border-2 border-ink px-1.5 py-0.5 text-[12px] font-bold leading-tight transition hover:-translate-y-px hover:shadow-pop-sm",
                                  categoryStyle(e.category).chip,
                                  e.status === "cancelled" && "line-through opacity-70",
                                )}
                              >
                                {e.title}
                              </Link>
                            </li>
                          ))}
                          {list.length > 3 && (
                            <li>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setSelected(key);
                                }}
                                className="px-1 text-[12px] font-bold underline decoration-fr-yellow decoration-2 underline-offset-2"
                              >
                                +{list.length - 3} more
                              </button>
                            </li>
                          )}
                        </ul>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected day */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.section
                key={selected}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-8"
                aria-live="polite"
              >
                <h3 className="font-display text-2xl font-bold">
                  {longDate(selected)}
                  {selected === today && <span className="ml-2 font-hand text-2xl font-normal text-fr-blue">today!</span>}
                </h3>
                {selectedEvents.length ? (
                  <ul className="mt-4 grid gap-4 md:grid-cols-2">
                    {selectedEvents.map((e) => (
                      <EventRow key={e.id} e={e} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[15px] text-fr-charcoal">No events on this day.</p>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className={clsx("mt-6 transition-opacity", loading && "opacity-60")}>
          {listDays.length === 0 ? (
            <div className="card-pop bg-white p-10 text-center">
              <p className="h-display text-3xl">No events this month</p>
              <p className="mt-2 text-[15px] text-fr-charcoal">Try the next month, or browse all events.</p>
            </div>
          ) : (
            <ol className="space-y-8">
              {listDays.map((k) => (
                <li key={k} className="grid gap-4 sm:grid-cols-[140px_1fr]">
                  <div className="sm:pt-3">
                    <p className="h-display text-4xl leading-none">{Number(k.slice(8))}</p>
                    <p className="mt-1 text-[13px] font-bold uppercase tracking-[0.12em] text-fr-muted">
                      {longDate(k).split(",")[0]}
                      {k === today && <span className="ml-2 rounded-full border-2 border-ink bg-fr-yellow px-2 text-ink">Today</span>}
                    </p>
                  </div>
                  <ul className="grid gap-4 md:grid-cols-2">
                    {(byDay.get(k) ?? []).map((e) => (
                      <EventRow key={e.id} e={e} />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function EventRow({ e }: { e: CalendarEvent }) {
  const place = [e.venue, e.location].filter(Boolean).join(", ") || (e.isOnline ? "Online" : "Venue TBA");
  return (
    <li>
      <Link href={`/events/${e.slug}`} className="card-pop card-pop-hover flex h-full gap-4 bg-white p-4">
        <span className="mt-1 h-full w-2 shrink-0 self-stretch rounded-full border-2 border-ink" style={{ background: categoryStyle(e.category).hex }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-fr-muted">
            {formatTime(e.startsAt, e.timezone)} {tzLabel(e.timezone)} · {e.category} · {feeLabel(e.fee)}
          </span>
          <span className={clsx("mt-1 block font-display text-lg font-bold leading-tight", e.status === "cancelled" && "line-through")}>{e.title}</span>
          {e.status === "cancelled" && <span className="mt-1 inline-block rounded-full bg-fr-red px-2 text-[12px] font-bold text-white">Cancelled</span>}
          <span className="mt-1.5 flex items-center gap-1.5 text-[14px] text-fr-charcoal">
            {e.isOnline ? <Wifi className="h-4 w-4 shrink-0" /> : <MapPin className="h-4 w-4 shrink-0" />}
            <span className="truncate">{place}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
