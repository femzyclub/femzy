// Events domain types. Mirrors supabase/migrations/004_events.sql.

export const EVENT_CATEGORIES = ["Sports", "Tournament", "Workshop", "Wellness", "Meetup", "Webinar", "Other"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export type EventStatus = "draft" | "published" | "cancelled";
export type EventRegistrationStatus = "pending_payment" | "confirmed" | "cancelled";

export const FORM_FIELD_TYPES = ["text", "textarea", "number", "select", "checkbox"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** A custom question on the registration form (name, email, phone and age are always asked). */
export interface EventFormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[]; // for "select"
  placeholder?: string;
}

export interface AgendaItem {
  time: string; // free text, e.g. "7:00 AM" or "Day 1 · 9:00"
  title: string;
  description?: string;
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  coverUrl: string | null;
  coverPath: string | null;
  startsAt: string; // ISO (UTC)
  endsAt: string; // ISO (UTC)
  timezone: string;
  venue: string | null;
  location: string | null;
  mapUrl: string | null;
  isOnline: boolean;
  fee: number; // rupees, 0 = free
  capacity: number | null; // null = unlimited
  registeredCount: number;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  status: EventStatus;
  isFeatured: boolean;
  agenda: AgendaItem[];
  organizerName: string | null;
  organizerEmail: string | null;
  organizerPhone: string | null;
  formFields: EventFormField[];
  cancellationNote: string | null;
  createdAt: string;
}

/** Light shape sent to the calendar. */
export interface CalendarEvent {
  id: string;
  slug: string;
  title: string;
  category: EventCategory;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venue: string | null;
  location: string | null;
  isOnline: boolean;
  fee: number;
  status: EventStatus;
}

export type RegistrationState = "open" | "full" | "closed" | "not_open" | "cancelled" | "past";

export interface EventRegistrationRow {
  id: string;
  event_id: string;
  registration_code: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  age: number;
  answers: Record<string, string>;
  status: EventRegistrationStatus;
  amount: number;
  utr: string | null;
  proof_path: string | null;
  admin_note: string | null;
  source: "web" | "admin";
  created_at: string;
  reviewed_at: string | null;
  cancelled_at: string | null;
}
