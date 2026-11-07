import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, ExternalLink, Hourglass, Mail, MapPin, Phone, Ticket, Users, Wifi } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { DemoBanner } from "@/components/DemoBanner";
import { Blob } from "@/components/doodle/Doodles";
import { CategoryChip, EventCover, StateChip } from "@/components/events/EventBits";
import { RegistrationForm } from "@/components/events/RegistrationForm";
import { env } from "@/lib/env";
import { getNavFee, getPublicEventBySlug } from "@/lib/events/data";
import { feeLabel, registrationState, seatsLeft } from "@/lib/events/shared";
import { formatDateTime, formatRange, tzLabel } from "@/lib/events/time";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Rendered per request so signed-in members see their own registration and get their details pre-filled.
export const dynamic = "force-dynamic";

const QR_FILES = ["/payments/upi-qr.jpeg", "/payments/upi-qr.jpg", "/payments/upi-qr.png"];

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { event } = await getPublicEventBySlug(slug);
  if (!event) return { title: "Event not found — Femrise!" };
  const description = (event.summary || event.description).slice(0, 160) || `${event.title} — a Femrise event.`;
  const images = [event.coverUrl ?? "/brand/femrise-logo.png"];
  return {
    title: `${event.title} — Femrise! Events`,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: { type: "website", title: event.title, description, images },
    twitter: { card: event.coverUrl ? "summary_large_image" : "summary", title: event.title, description, images },
    robots: event.status === "cancelled" ? { index: false } : undefined,
  };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const [{ event, isDemo }, fee] = await Promise.all([getPublicEventBySlug(slug), getNavFee()]);
  if (!event) notFound();

  // Signed-in member? Pre-fill the form and show an existing registration.
  let prefill = { fullName: "", email: "", phone: "" };
  let existing: { code: string; status: string } | null = null;
  let signedIn = false;
  const supabase = await createSupabaseServerClient();
  if (supabase && !isDemo) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      signedIn = true;
      const [{ data: profile }, { data: contact }, { data: reg }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("profile_contacts").select("email, phone").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("event_registrations")
          .select("registration_code, status")
          .eq("event_id", event.id)
          .eq("user_id", user.id)
          .neq("status", "cancelled")
          .maybeSingle(),
      ]);
      prefill = { fullName: profile?.full_name ?? "", email: contact?.email ?? user.email ?? "", phone: contact?.phone ?? "" };
      if (reg) existing = { code: reg.registration_code, status: reg.status };
    }
  }

  const now = Date.now();
  const state = registrationState(event, now);
  const left = seatsLeft(event);
  const deadline = event.registrationClosesAt ?? event.startsAt;
  const tz = event.timezone;
  const place = [event.venue, event.location].filter(Boolean).join(", ");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.summary || event.description,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventStatus: event.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: event.isOnline ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    location: event.isOnline
      ? { "@type": "VirtualLocation", url: `${env.siteUrl}/events/${event.slug}` }
      : { "@type": "Place", name: event.venue ?? place, address: event.location ?? place },
    image: [event.coverUrl ?? `${env.siteUrl}/brand/femrise-logo.png`],
    organizer: { "@type": "Organization", name: event.organizerName || "Fem Rise Club", url: env.siteUrl },
    offers: {
      "@type": "Offer",
      price: event.fee,
      priceCurrency: "INR",
      url: `${env.siteUrl}/events/${event.slug}`,
      availability: state === "full" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      validThrough: deadline,
    },
  };

  return (
    <>
      {isDemo && <DemoBanner />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Navbar fee={fee} />
      <main className="relative overflow-hidden pb-24 pt-[72px] lg:pt-[84px]">
        <Blob seed={5} color="#FBBE18" className="absolute -right-32 top-10 w-[460px] opacity-90" />
        <div className="container-x relative pt-8">
          <Link href="/events" className="inline-flex items-center gap-1.5 text-[14px] font-bold underline decoration-fr-yellow decoration-[3px] underline-offset-4">
            <ArrowLeft className="h-4 w-4" /> All events
          </Link>

          {event.status === "cancelled" && (
            <div className="mt-6 rounded-[14px] border-2 border-ink bg-fr-red p-4 font-bold text-white shadow-pop-sm">
              This event has been cancelled.{event.cancellationNote ? ` ${event.cancellationNote}` : ""}
            </div>
          )}

          <EventCover event={event} priority sizes="(min-width: 1240px) 1160px, 100vw" className="card-pop mt-6 aspect-[16/9] sm:aspect-[21/8]" />

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryChip category={event.category} />
                <StateChip state={state} />
                {event.isFeatured && <span className="font-hand text-xl text-fr-blue">featured!</span>}
              </div>
              <h1 className="h-display mt-4 text-5xl sm:text-6xl lg:text-7xl">{event.title}</h1>
              {event.summary && <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-fr-charcoal">{event.summary}</p>}

              {event.description && (
                <section className="mt-10">
                  <span className="eyebrow">About this event</span>
                  <div className="mt-4 whitespace-pre-line text-[16px] leading-relaxed text-ink">{event.description}</div>
                </section>
              )}

              {event.agenda.length > 0 && (
                <section className="mt-12">
                  <span className="eyebrow">Schedule</span>
                  <ol className="relative mt-6 space-y-5 border-l-2 border-dashed border-ink pl-6">
                    {event.agenda.map((a, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-ink bg-fr-yellow" aria-hidden />
                        <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-fr-muted">{a.time}</p>
                        <p className="font-display text-xl font-bold">{a.title}</p>
                        {a.description && <p className="mt-1 text-[15px] text-fr-charcoal">{a.description}</p>}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {(event.organizerName || event.organizerEmail || event.organizerPhone) && (
                <section className="mt-12">
                  <span className="eyebrow">Organiser</span>
                  <div className="card-pop mt-5 bg-white p-5">
                    <p className="font-display text-xl font-bold">{event.organizerName || "Fem Rise Club"}</p>
                    <ul className="mt-2 space-y-1 text-[15px]">
                      {event.organizerEmail && (
                        <li className="flex items-center gap-2">
                          <Mail className="h-4 w-4" aria-hidden />
                          <a href={`mailto:${event.organizerEmail}`} className="underline decoration-fr-yellow decoration-2 underline-offset-4">
                            {event.organizerEmail}
                          </a>
                        </li>
                      )}
                      {event.organizerPhone && (
                        <li className="flex items-center gap-2">
                          <Phone className="h-4 w-4" aria-hidden />
                          <a href={`tel:${event.organizerPhone.replace(/\s/g, "")}`} className="underline decoration-fr-yellow decoration-2 underline-offset-4">
                            {event.organizerPhone}
                          </a>
                        </li>
                      )}
                    </ul>
                  </div>
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-[108px] lg:self-start">
              <div className="card-pop bg-fr-cream p-6">
                <ul className="space-y-4 text-[15px]">
                  <Info icon={<CalendarDays className="h-5 w-5" />} label="When">
                    {formatRange(event.startsAt, event.endsAt, tz)} {tzLabel(tz)}
                  </Info>
                  <Info icon={event.isOnline ? <Wifi className="h-5 w-5" /> : <MapPin className="h-5 w-5" />} label="Where">
                    {place || (event.isOnline ? "Online" : "Venue to be announced")}
                    {event.mapUrl && (
                      <a href={event.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-[14px] font-bold underline decoration-fr-yellow decoration-2 underline-offset-4">
                        Open in maps <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </Info>
                  <Info icon={<Ticket className="h-5 w-5" />} label="Fee">
                    {feeLabel(event.fee)}
                  </Info>
                  <Info icon={<Users className="h-5 w-5" />} label="Spots">
                    {left == null ? "Open to all" : left > 0 ? `${left} of ${event.capacity} left` : `Full (${event.capacity})`}
                  </Info>
                  <Info icon={<Hourglass className="h-5 w-5" />} label="Register by">
                    {formatDateTime(deadline, tz)} {tzLabel(tz)}
                  </Info>
                  {event.registrationOpensAt && state === "not_open" && (
                    <Info icon={<Clock className="h-5 w-5" />} label="Registrations open">
                      {formatDateTime(event.registrationOpensAt, tz)} {tzLabel(tz)}
                    </Info>
                  )}
                </ul>
                {state === "open" && !existing && (
                  <a href="#register" className="btn-primary mt-6 w-full">
                    Register now{event.fee > 0 ? ` — ${feeLabel(event.fee)}` : ""}
                  </a>
                )}
              </div>
            </aside>
          </div>

          <section id="register" className="mt-16 scroll-mt-28">
            <RegistrationForm
              event={{ id: event.id, slug: event.slug, title: event.title, fee: event.fee, formFields: event.formFields }}
              state={state}
              isDemo={isDemo}
              signedIn={signedIn}
              prefill={prefill}
              existing={existing}
              upi={{ qrFiles: QR_FILES, upiId: env.upiId, upiName: env.upiName }}
            />
          </section>
        </div>
      </main>
      <Footer fee={fee} cta={false} />
    </>
  );
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-fr-muted">{label}</p>
        <div className="font-bold">{children}</div>
      </div>
    </li>
  );
}
