// Helpers safe to use on both server and client.
import type { EventCategory, EventItem, RegistrationState } from "@/lib/events/types";

/**
 * Category look — built ONLY from the existing Femrise palette (tailwind.config.ts).
 * `chip` = Tailwind classes, `hex` = the same palette colour for dots / SVG.
 */
export const CATEGORY_STYLE: Record<EventCategory, { chip: string; hex: string }> = {
  Sports: { chip: "bg-fr-green text-ink", hex: "#62B946" },
  Tournament: { chip: "bg-fr-yellow text-ink", hex: "#FBBE18" },
  Workshop: { chip: "bg-fr-blue text-white", hex: "#1748E8" },
  Wellness: { chip: "bg-fr-orange text-ink", hex: "#F4A623" },
  Meetup: { chip: "bg-fr-softblue text-ink", hex: "#DCE8FF" },
  Webinar: { chip: "bg-fr-softgreen text-ink", hex: "#E5F4DF" },
  Other: { chip: "bg-fr-cream text-ink", hex: "#FFF6D8" },
};

export function categoryStyle(c: string) {
  return CATEGORY_STYLE[(c as EventCategory) in CATEGORY_STYLE ? (c as EventCategory) : "Other"];
}

type StateInput = Pick<EventItem, "status" | "startsAt" | "endsAt" | "capacity" | "registeredCount" | "registrationOpensAt" | "registrationClosesAt">;

/** Mirrors the checks inside register_for_event() so the button matches what the database will allow. */
export function registrationState(e: StateInput, now = Date.now()): RegistrationState {
  if (e.status === "cancelled") return "cancelled";
  if (new Date(e.endsAt).getTime() < now) return "past";
  if (e.registrationOpensAt && now < new Date(e.registrationOpensAt).getTime()) return "not_open";
  if (now > new Date(e.registrationClosesAt ?? e.startsAt).getTime()) return "closed";
  if (e.capacity != null && e.registeredCount >= e.capacity) return "full";
  return "open";
}

export const REGISTRATION_LABEL: Record<RegistrationState, string> = {
  open: "Registrations open",
  full: "Sold out",
  closed: "Registrations closed",
  not_open: "Opening soon",
  cancelled: "Cancelled",
  past: "Event ended",
};

export function seatsLeft(e: Pick<EventItem, "capacity" | "registeredCount">) {
  return e.capacity == null ? null : Math.max(0, e.capacity - e.registeredCount);
}

export const feeLabel = (fee: number) => (fee > 0 ? `₹${fee.toLocaleString("en-IN")}` : "Free");

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

/** Friendly text for the error codes raised by the database functions. */
export function registrationErrorMessage(raw: string) {
  const code = raw.split(":")[0].trim();
  switch (code) {
    case "EVENT_NOT_FOUND":
      return "This event isn't available.";
    case "EVENT_CANCELLED":
      return "This event has been cancelled.";
    case "NOT_OPEN_YET":
      return "Registrations haven't opened yet.";
    case "REGISTRATION_CLOSED":
      return "Registrations for this event are closed.";
    case "EVENT_FULL":
      return "Sorry — this event is full.";
    case "ALREADY_REGISTERED":
      return "You're already registered for this event with this email.";
    case "MISSING_FIELD":
      return `Please fill in: ${raw.split(":").slice(1).join(":").trim() || "all required fields"}.`;
    case "INVALID_UTR":
      return "Enter the 12-digit UPI transaction ID (UTR) shown in your payment app.";
    case "MISSING_PROOF":
      return "Please upload the payment screenshot.";
    case "UTR_USED":
      return "This UPI transaction ID has already been used.";
    default:
      return null;
  }
}
