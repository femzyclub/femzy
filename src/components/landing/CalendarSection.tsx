import { SectionHead } from "@/components/ui/SectionHead";
import { ButtonLink } from "@/components/ui/Button";
import { EventsCalendar } from "@/components/events/EventsCalendar";
import type { CalendarEvent } from "@/lib/events/types";

/** The live monthly calendar, right on the home page. */
export function CalendarSection({ initialMonth, today, events }: { initialMonth: string; today: string; events: CalendarEvent[] }) {
  return (
    <section id="calendar" className="scroll-mt-24 py-24 lg:py-32">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHead
            eyebrow="Events calendar"
            title={
              <>
                What&apos;s on <span className="font-hand font-normal text-fr-green">this month?</span>
              </>
            }
            intro="Tap a date to see everything happening that day, or switch to the list view."
          />
          <ButtonLink href="/events/calendar" variant="outline">
            Full calendar
          </ButtonLink>
        </div>
        <div className="mt-12">
          <EventsCalendar initialMonth={initialMonth} today={today} initialEvents={events} />
        </div>
      </div>
    </section>
  );
}
