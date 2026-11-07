import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { EventForm } from "@/components/admin/EventForm";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New event — Femrise! admin", robots: { index: false } };

export default async function NewEventPage() {
  await requireAdmin("/admin/events/new");
  return (
    <div className="min-h-screen pb-20">
      <AdminHeader active="events" />
      <main className="container-x max-w-4xl pt-8">
        <Link href="/admin/events" className="text-[14px] font-bold underline decoration-fr-yellow decoration-[3px] underline-offset-4">
          ← All events
        </Link>
        <h1 className="h-display mt-4 text-4xl sm:text-5xl">New event</h1>
        <p className="mt-2 text-[15px] text-fr-charcoal">Save as a draft to keep it hidden, or publish to put it on the website and calendar straight away.</p>
        <div className="mt-8">
          <EventForm
            initial={{
              title: "",
              slug: "",
              summary: "",
              description: "",
              category: "Meetup",
              coverUrl: null,
              startsAt: "",
              endsAt: "",
              venue: "",
              location: "Hyderabad",
              mapUrl: "",
              isOnline: false,
              fee: 0,
              capacity: null,
              registrationOpensAt: "",
              registrationClosesAt: "",
              isFeatured: false,
              agenda: [],
              organizerName: "Fem Rise Club",
              organizerEmail: "",
              organizerPhone: "",
              formFields: [],
            }}
          />
        </div>
      </main>
    </div>
  );
}
