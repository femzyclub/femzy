import "server-only";
import { cache } from "react";
import { env } from "@/lib/env";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { EVENT_CATEGORIES, FORM_FIELD_TYPES } from "@/lib/events/types";
import type { AgendaItem, CalendarEvent, EventCategory, EventFormField, EventItem } from "@/lib/events/types";
import { DEFAULT_TZ, wallTimeToUtc, dateKey } from "@/lib/events/time";

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  cover_path: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue: string | null;
  location: string | null;
  map_url: string | null;
  is_online: boolean;
  fee: number;
  capacity: number | null;
  registered_count: number;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  status: EventItem["status"];
  is_featured: boolean;
  agenda: unknown;
  organizer_name: string | null;
  organizer_email: string | null;
  organizer_phone: string | null;
  form_fields: unknown;
  cancellation_note: string | null;
  created_at: string;
};

export const coverUrl = (path: string | null) =>
  path ? `${env.supabaseUrl}/storage/v1/object/public/event-covers/${path}` : null;

function asAgenda(v: unknown): AgendaItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({ time: String(a.time ?? ""), title: String(a.title ?? ""), description: a.description ? String(a.description) : undefined }))
    .filter((a) => a.title);
}

export function asFormFields(v: unknown): EventFormField[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      id: String(f.id ?? ""),
      label: String(f.label ?? ""),
      type: (FORM_FIELD_TYPES as readonly string[]).includes(String(f.type)) ? (f.type as EventFormField["type"]) : "text",
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? f.options.map(String).filter(Boolean) : undefined,
      placeholder: f.placeholder ? String(f.placeholder) : undefined,
    }))
    .filter((f) => f.id && f.label);
}

export function mapEvent(r: EventRow): EventItem {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary ?? "",
    description: r.description ?? "",
    category: ((EVENT_CATEGORIES as readonly string[]).includes(r.category) ? r.category : "Other") as EventCategory,
    coverPath: r.cover_path,
    coverUrl: coverUrl(r.cover_path),
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    timezone: r.timezone || DEFAULT_TZ,
    venue: r.venue,
    location: r.location,
    mapUrl: r.map_url,
    isOnline: r.is_online,
    fee: r.fee,
    capacity: r.capacity,
    registeredCount: r.registered_count,
    registrationOpensAt: r.registration_opens_at,
    registrationClosesAt: r.registration_closes_at,
    status: r.status,
    isFeatured: r.is_featured,
    agenda: asAgenda(r.agenda),
    organizerName: r.organizer_name,
    organizerEmail: r.organizer_email,
    organizerPhone: r.organizer_phone,
    formFields: asFormFields(r.form_fields),
    cancellationNote: r.cancellation_note,
    createdAt: r.created_at,
  };
}

export const toCalendarEvent = (e: EventItem): CalendarEvent => ({
  id: e.id,
  slug: e.slug,
  title: e.title,
  category: e.category,
  startsAt: e.startsAt,
  endsAt: e.endsAt,
  timezone: e.timezone,
  venue: e.venue,
  location: e.location,
  isOnline: e.isOnline,
  fee: e.fee,
  status: e.status,
});

/** "fetch failed" = Supabase couldn't be reached at all (offline, wrong URL, or paused project). */
const isNetworkError = (msg?: string) => Boolean(msg && /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(msg));

// ---------------------------------------------------------------------------
// Public loaders (published + cancelled only — drafts never leave the admin area)
// ---------------------------------------------------------------------------

/** All public events, oldest first. Falls back to sample events when Supabase isn't connected. */
export const getPublicEvents = cache(async (): Promise<{ events: EventItem[]; isDemo: boolean }> => {
  const supabase = createSupabasePublicClient();
  if (!supabase) return { events: demoEvents(), isDemo: true };
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .in("status", ["published", "cancelled"])
    .order("starts_at", { ascending: true })
    .limit(500);
  if (error) {
    if (isNetworkError(error.message)) {
      console.warn("[events] can't reach Supabase — showing demo events", error.message);
      return { events: demoEvents(), isDemo: true };
    }
    console.warn("[events] could not load events (did you run supabase/migrations/004_events.sql?)", error.message);
    return { events: [], isDemo: false };
  }
  return { events: (data as EventRow[]).map(mapEvent), isDemo: false };
});

export const getPublicEventBySlug = cache(async (slug: string): Promise<{ event: EventItem | null; isDemo: boolean }> => {
  const supabase = createSupabasePublicClient();
  if (!supabase) return { event: demoEvents().find((e) => e.slug === slug) ?? null, isDemo: true };
  const { data, error } = await supabase.from("events").select("*").eq("slug", slug).in("status", ["published", "cancelled"]).maybeSingle<EventRow>();
  if (error && isNetworkError(error.message)) return { event: demoEvents().find((e) => e.slug === slug) ?? null, isDemo: true };
  return { event: data ? mapEvent(data) : null, isDemo: false };
});

/** Events overlapping [from, to) — used by the calendar. */
export async function getPublicEventsInRange(from: Date, to: Date): Promise<{ events: CalendarEvent[]; isDemo: boolean }> {
  const supabase = createSupabasePublicClient();
  if (!supabase) {
    const events = demoEvents().filter((e) => new Date(e.startsAt) < to && new Date(e.endsAt) >= from);
    return { events: events.map(toCalendarEvent), isDemo: true };
  }
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .in("status", ["published", "cancelled"])
    .lt("starts_at", to.toISOString())
    .gte("ends_at", from.toISOString())
    .order("starts_at", { ascending: true })
    .limit(500);
  if (error) {
    if (isNetworkError(error.message)) {
      const events = demoEvents().filter((e) => new Date(e.startsAt) < to && new Date(e.endsAt) >= from);
      return { events: events.map(toCalendarEvent), isDemo: true };
    }
    throw new Error(error.message);
  }
  return { events: (data as EventRow[]).map(mapEvent).map(toCalendarEvent), isDemo: false };
}

// ---------------------------------------------------------------------------
// Demo events — shown ONLY when Supabase isn't connected (with the "Demo data" badge).
// Dates are relative to today so the calendar always has something to show.
// ---------------------------------------------------------------------------
function demoEvents(): EventItem[] {
  const today = dateKey(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const at = (offsetDays: number, time: string) => {
    const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
    return wallTimeToUtc(`${dt.toISOString().slice(0, 10)}T${time}`)!.toISOString();
  };
  const base = {
    coverUrl: null,
    coverPath: null,
    timezone: DEFAULT_TZ,
    mapUrl: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    organizerName: "Femzy",
    organizerEmail: null,
    organizerPhone: null,
    cancellationNote: null,
    createdAt: new Date().toISOString(),
  };
  return [
    {
      ...base,
      id: "demo-1",
      slug: "sunrise-run-club",
      title: "Sunrise Run Club — 5K",
      summary: "An easy-paced 5K around the lake, followed by stretching and chai.",
      description: "Bring your running shoes and a friend. All paces welcome — nobody gets left behind.",
      category: "Sports",
      startsAt: at(3, "06:00"),
      endsAt: at(3, "08:00"),
      venue: "KBR Park, Gate 1",
      location: "Jubilee Hills, Hyderabad",
      isOnline: false,
      fee: 0,
      capacity: 60,
      registeredCount: 41,
      status: "published",
      isFeatured: true,
      agenda: [
        { time: "6:00 AM", title: "Warm-up" },
        { time: "6:20 AM", title: "5K run" },
        { time: "7:30 AM", title: "Stretch + chai" },
      ],
      formFields: [{ id: "pace", label: "Usual 5K pace", type: "select", required: false, options: ["Walk", "Easy jog", "Under 30 min"] }],
    },
    {
      ...base,
      id: "demo-2",
      slug: "badminton-doubles-cup",
      title: "Badminton Doubles Cup",
      summary: "Women's doubles knockout. Register with your partner.",
      description: "Knockout format, 21-point games. Shuttles provided.",
      category: "Tournament",
      startsAt: at(9, "09:00"),
      endsAt: at(9, "17:00"),
      venue: "Smash Arena",
      location: "Gachibowli, Hyderabad",
      isOnline: false,
      fee: 299,
      capacity: 32,
      registeredCount: 32,
      status: "published",
      isFeatured: true,
      agenda: [],
      formFields: [{ id: "partner", label: "Partner's name", type: "text", required: true }],
    },
    {
      ...base,
      id: "demo-3",
      slug: "mobility-for-athletes",
      title: "Mobility for Athletes",
      summary: "A 60-minute online session on injury-proof mobility routines.",
      description: "Live on Zoom. Link is shared after registration.",
      category: "Workshop",
      startsAt: at(9, "19:00"),
      endsAt: at(9, "20:00"),
      venue: "Online",
      location: null,
      isOnline: true,
      fee: 0,
      capacity: null,
      registeredCount: 118,
      status: "published",
      isFeatured: false,
      agenda: [],
      formFields: [],
    },
    {
      ...base,
      id: "demo-4",
      slug: "breathwork-and-recovery",
      title: "Breathwork & Recovery Morning",
      summary: "Slow down after the Mid-Winter Arc with breathwork and a guided cool-down.",
      description: "",
      category: "Wellness",
      startsAt: at(16, "07:30"),
      endsAt: at(16, "09:00"),
      venue: "The Courtyard Studio",
      location: "Banjara Hills, Hyderabad",
      isOnline: false,
      fee: 149,
      capacity: 25,
      registeredCount: 9,
      status: "published",
      isFeatured: false,
      agenda: [],
      formFields: [],
    },
    {
      ...base,
      id: "demo-5",
      slug: "community-kickoff-meetup",
      title: "Community Kick-off Meetup",
      summary: "Meet the Femzy community, swap sports stories and plan the next season.",
      description: "",
      category: "Meetup",
      startsAt: at(-12, "17:00"),
      endsAt: at(-12, "19:00"),
      venue: "Roastery Coffee House",
      location: "Banjara Hills, Hyderabad",
      isOnline: false,
      fee: 0,
      capacity: 50,
      registeredCount: 47,
      status: "published",
      isFeatured: false,
      agenda: [],
      formFields: [],
    },
  ];
}
