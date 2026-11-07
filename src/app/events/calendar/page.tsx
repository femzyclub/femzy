import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { DemoBanner } from "@/components/DemoBanner";
import { Blob } from "@/components/doodle/Doodles";
import { EventsCalendar } from "@/components/events/EventsCalendar";
import { EventsTabs } from "@/components/events/EventBits";
import { getPublicEventsInRange } from "@/lib/events/data";
import { monthRangeUtc, todayKey } from "@/lib/events/time";
import type { CalendarEvent } from "@/lib/events/types";

// Always fresh: opens on the current month (IST) with live data from the database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events Calendar — Femrise!",
  description: "Every Femrise event in one monthly calendar. Pick a date to see what's on.",
  alternates: { canonical: "/events/calendar" },
};

export default async function EventsCalendarPage() {
  const today = todayKey();
  const [y, m] = today.split("-").map(Number);
  const { from, to } = monthRangeUtc(y, m);
  let initial: CalendarEvent[] = [];
  let isDemo = false;
  try {
    const res = await getPublicEventsInRange(from, to);
    initial = res.events;
    isDemo = res.isDemo;
  } catch (e) {
    console.warn("[events] calendar initial load failed", e);
  }

  return (
    <>
      {isDemo && <DemoBanner />}
      <Navbar />
      <main className="pt-[72px] lg:pt-[84px]">
        <section className="relative overflow-hidden pb-8 pt-16 lg:pt-20">
          <Blob seed={23} color="#1748E8" wobble={0.35} className="absolute -right-10 top-6 w-40 sm:w-56" />
          <Blob seed={9} color="#FBBE18" className="absolute -left-40 -top-20 hidden w-[380px] opacity-80 lg:block" />
          <div className="container-x relative">
            <span className="eyebrow">Events calendar</span>
            <h1 className="h-display mt-5 text-6xl sm:text-8xl">
              What&apos;s <span className="font-hand font-normal text-fr-green">on?</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-fr-charcoal">
              Every Femrise event, month by month. Tap a date to see what&apos;s happening, or an event to register.
            </p>
            <div className="mt-8">
              <EventsTabs active="calendar" />
            </div>
          </div>
        </section>
        <section className="container-x pb-24">
          <EventsCalendar initialMonth={today.slice(0, 7)} today={today} initialEvents={initial} />
        </section>
      </main>
      <Footer cta={false} />
    </>
  );
}
