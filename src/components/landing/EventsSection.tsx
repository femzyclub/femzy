import { ButtonLink } from "@/components/ui/Button";
import { SectionHead } from "@/components/ui/SectionHead";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { EventCard } from "@/components/events/EventBits";
import type { EventItem } from "@/lib/events/types";

/** Landing-page teaser: the next few upcoming events (featured first), with links to the full list and calendar. */
export function EventsSection({ events, now }: { events: EventItem[]; now: number }) {
  const upcoming = events
    .filter((e) => e.status === "published" && new Date(e.endsAt).getTime() >= now)
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3);

  return (
    <section id="events" className="scroll-mt-24 py-24 lg:py-32">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHead
            eyebrow="Femrise events"
            title={
              <>
                Show up. <span className="font-hand font-normal text-fr-blue">Play together!</span>
              </>
            }
            intro="Runs, tournaments, workshops and meetups for women who play. Pick an event and save your spot online."
          />
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/events">See all events</ButtonLink>
            <ButtonLink href="/events/calendar" variant="outline">
              Events calendar
            </ButtonLink>
          </div>
        </div>

        {upcoming.length === 0 ? (
          <div className="card-pop mt-12 bg-white p-10 text-center">
            <p className="h-display text-3xl">New events coming soon</p>
            <p className="mx-auto mt-3 max-w-md text-[15px] text-fr-charcoal">Keep an eye on the calendar — upcoming Femrise events will show up here as soon as they&apos;re announced.</p>
          </div>
        ) : (
          <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <StaggerItem key={e.id} className="h-full">
                <EventCard event={e} now={now} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </section>
  );
}
