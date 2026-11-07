import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { DemoBanner } from "@/components/DemoBanner";
import { Blob, Sticker } from "@/components/doodle/Doodles";
import { EventsBrowser } from "@/components/events/EventsBrowser";
import { EventsTabs } from "@/components/events/EventBits";
import { getNavFee, getPublicEvents } from "@/lib/events/data";

// Admin changes revalidate this page instantly; this is only the safety net.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Events — Femrise!",
  description: "Runs, tournaments, workshops and meetups for women who play. Find upcoming Femrise events and register online.",
  alternates: { canonical: "/events" },
  openGraph: {
    title: "Events — Femrise!",
    description: "Find upcoming Femrise events and register online.",
    images: ["/brand/femrise-logo.png"],
  },
};

export default async function EventsPage() {
  const [{ events, isDemo }, fee] = await Promise.all([getPublicEvents(), getNavFee()]);
  const now = Date.now();
  const upcomingCount = events.filter((e) => new Date(e.endsAt).getTime() >= now && e.status === "published").length;

  return (
    <>
      {isDemo && <DemoBanner />}
      <Navbar fee={fee} />
      <main className="pt-[72px] lg:pt-[84px]">
        <section className="relative overflow-hidden pb-10 pt-16 lg:pt-20">
          <Blob seed={7} color="#FBBE18" className="absolute -right-24 -top-10 w-[520px]" />
          <Blob seed={19} color="#62B946" wobble={0.35} className="absolute right-[32%] top-20 hidden w-24 lg:block" />
          <div className="container-x relative">
            <span className="eyebrow">Femrise events</span>
            <h1 className="h-display mt-5 text-6xl sm:text-8xl">
              Show up. <span className="font-hand font-normal text-fr-blue">Play together!</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-fr-charcoal">
              Runs, tournaments, workshops and meetups for women who play. Pick an event, save your spot online and meet the community.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <EventsTabs active="list" />
              <Sticker color="#E5F4DF" rotate={-4}>
                {upcomingCount} upcoming
              </Sticker>
            </div>
          </div>
        </section>
        <section className="container-x pb-24">
          <EventsBrowser events={events} now={now} />
        </section>
      </main>
      <Footer fee={fee} cta={false} />
    </>
  );
}
