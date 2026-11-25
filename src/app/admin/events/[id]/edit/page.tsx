import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { EventForm } from "@/components/admin/EventForm";
import { requireAdmin } from "@/lib/admin";
import { mapEvent, type EventRow } from "@/lib/events/data";
import { utcToWallTime } from "@/lib/events/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit event — Femzy admin", robots: { index: false } };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin(`/admin/events/${id}/edit`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle<EventRow>();
  if (!data) notFound();
  const e = mapEvent(data);
  const tz = e.timezone;

  return (
    <div className="min-h-screen pb-20">
      <AdminHeader active="events" />
      <main className="container-x max-w-4xl pt-8">
        <Link href={`/admin/events/${e.id}`} className="text-[14px] font-bold underline decoration-fr-yellow decoration-[3px] underline-offset-4">
          ← Back to {e.title}
        </Link>
        <h1 className="h-display mt-4 text-4xl sm:text-5xl">Edit event</h1>
        <div className="mt-8">
          <EventForm
            initial={{
              id: e.id,
              status: e.status,
              title: e.title,
              slug: e.slug,
              summary: e.summary,
              description: e.description,
              category: e.category,
              coverUrl: e.coverUrl,
              startsAt: utcToWallTime(e.startsAt, tz),
              endsAt: utcToWallTime(e.endsAt, tz),
              venue: e.venue ?? "",
              location: e.location ?? "",
              mapUrl: e.mapUrl ?? "",
              isOnline: e.isOnline,
              fee: e.fee,
              capacity: e.capacity,
              registrationOpensAt: utcToWallTime(e.registrationOpensAt, tz),
              registrationClosesAt: utcToWallTime(e.registrationClosesAt, tz),
              isFeatured: e.isFeatured,
              agenda: e.agenda,
              organizerName: e.organizerName ?? "",
              organizerEmail: e.organizerEmail ?? "",
              organizerPhone: e.organizerPhone ?? "",
              formFields: e.formFields,
              registeredCount: e.registeredCount,
            }}
          />
        </div>
      </main>
    </div>
  );
}
