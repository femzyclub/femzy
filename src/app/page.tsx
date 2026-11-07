import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { SportsMarquee } from "@/components/landing/SportsMarquee";
import { EventsSection } from "@/components/landing/EventsSection";
import { CategoriesSection } from "@/components/landing/CategoriesSection";
import { CalendarSection } from "@/components/landing/CalendarSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { AboutSection } from "@/components/landing/AboutSection";
import { Footer } from "@/components/landing/Footer";
import { MobileExploreBar } from "@/components/landing/MobileExploreBar";
import { DemoBanner } from "@/components/DemoBanner";
import { getPublicEvents, toCalendarEvent } from "@/lib/events/data";
import { eventDateKeys, todayKey } from "@/lib/events/time";

// Admin changes refresh this page instantly; this is the safety net.
export const revalidate = 60;

export default async function HomePage() {
  const { events, isDemo } = await getPublicEvents();
  const now = Date.now();
  const upcoming = events
    .filter((e) => e.status === "published" && new Date(e.endsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  // Calendar opens on this month (IST) with this month's events already loaded.
  const today = todayKey();
  const month = today.slice(0, 7);
  const monthEvents = events.filter((e) => eventDateKeys(e.startsAt, e.endsAt, e.timezone).some((k) => k.startsWith(month))).map(toCalendarEvent);

  return (
    <>
      {isDemo && <DemoBanner />}
      <Navbar />
      <main>
        <Hero upcoming={upcoming} upcomingCount={upcoming.length} />
        <SportsMarquee />
        <EventsSection events={events} now={now} />
        <CategoriesSection events={events} now={now} />
        <CalendarSection initialMonth={month} today={today} events={monthEvents} />
        <HowItWorks />
        <AboutSection />
      </main>
      <Footer />
      <MobileExploreBar />
    </>
  );
}
