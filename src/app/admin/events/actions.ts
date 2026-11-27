"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminClient } from "@/lib/admin";
import { sniffImage } from "@/lib/events/images";
import { registrationErrorMessage, slugify } from "@/lib/events/shared";
import { DEFAULT_TZ, wallTimeToUtc } from "@/lib/events/time";
import { EVENT_CATEGORIES, FORM_FIELD_TYPES, type AgendaItem, type EventFormField } from "@/lib/events/types";

export type EventFormState = { error?: string } | undefined;
export type AddRegistrationState = { error?: string; code?: string } | undefined;

const RESERVED_SLUGS = new Set(["calendar", "new", "api", "admin"]);

/** Refresh every public page that shows events (listing, detail pages, calendar). */
function refreshPublic(slug?: string) {
  revalidatePath("/events", "layout");
  revalidatePath("/"); // landing page events section
  if (slug) revalidatePath(`/events/${slug}`);
  revalidatePath("/admin/events", "layout");
}

const str = (fd: FormData, k: string, max = 5000) => String(fd.get(k) ?? "").trim().slice(0, max);
const opt = (fd: FormData, k: string, max = 500) => str(fd, k, max) || null;

function parseAgenda(raw: string): AgendaItem[] {
  try {
    const v = JSON.parse(raw || "[]");
    if (!Array.isArray(v)) return [];
    return v
      .slice(0, 40)
      .map((a) => ({
        time: String(a?.time ?? "").trim().slice(0, 60),
        title: String(a?.title ?? "").trim().slice(0, 160),
        description: String(a?.description ?? "").trim().slice(0, 600) || undefined,
      }))
      .filter((a) => a.title);
  } catch {
    return [];
  }
}

function parseFormFields(raw: string): EventFormField[] {
  try {
    const v = JSON.parse(raw || "[]");
    if (!Array.isArray(v)) return [];
    const used = new Set<string>();
    return v
      .slice(0, 20)
      .map((f) => {
        const label = String(f?.label ?? "").trim().slice(0, 120);
        let id = slugify(String(f?.id || label)).replace(/-/g, "_").slice(0, 40) || "q";
        while (used.has(id) || ["full_name", "email", "phone", "age"].includes(id)) id = `${id}_2`;
        used.add(id);
        const type = (FORM_FIELD_TYPES as readonly string[]).includes(f?.type) ? (f.type as EventFormField["type"]) : "text";
        const options =
          type === "select"
            ? (Array.isArray(f?.options) ? f.options : String(f?.options ?? "").split(","))
                .map((o: unknown) => String(o).trim().slice(0, 80))
                .filter(Boolean)
                .slice(0, 30)
            : undefined;
        return { id, label, type, required: Boolean(f?.required), options, placeholder: String(f?.placeholder ?? "").trim().slice(0, 120) || undefined };
      })
      .filter((f) => f.label && (f.type !== "select" || (f.options?.length ?? 0) > 0));
  } catch {
    return [];
  }
}

export async function saveEvent(_prev: EventFormState, fd: FormData): Promise<EventFormState> {
  const admin = await getAdminClient();
  if (!admin) return { error: "Only admins can manage events. Please log in again." };
  const { supabase } = admin;

  const id = str(fd, "id", 64) || null;
  const intent = str(fd, "intent", 20); // "draft" | "publish" | "save"
  const tz = DEFAULT_TZ;

  const title = str(fd, "title", 120);
  if (title.length < 3) return { error: "Add an event title (at least 3 characters)." };
  let slug = slugify(str(fd, "slug", 80) || title);
  if (!slug) return { error: "The URL name can only use letters, numbers and dashes." };
  if (RESERVED_SLUGS.has(slug)) slug = `${slug}-event`;

  const category = str(fd, "category", 30);
  if (!(EVENT_CATEGORIES as readonly string[]).includes(category)) return { error: "Choose a category." };

  const starts = wallTimeToUtc(str(fd, "starts_at", 20), tz);
  const ends = wallTimeToUtc(str(fd, "ends_at", 20), tz);
  if (!starts) return { error: "Set the start date and time." };
  if (!ends) return { error: "Set the end date and time." };
  if (ends < starts) return { error: "The event can't end before it starts." };

  const opensRaw = str(fd, "registration_opens_at", 20);
  const closesRaw = str(fd, "registration_closes_at", 20);
  const opens = opensRaw ? wallTimeToUtc(opensRaw, tz) : null;
  const closes = closesRaw ? wallTimeToUtc(closesRaw, tz) : null;
  if (opensRaw && !opens) return { error: "Registration opening date is invalid." };
  if (closesRaw && !closes) return { error: "Registration closing date is invalid." };
  if (opens && closes && closes <= opens) return { error: "Registrations must close after they open." };
  if (closes && closes > ends) return { error: "Registrations should close before the event ends." };

  const fee = Number(str(fd, "fee", 10) || 0);
  if (!Number.isInteger(fee) || fee < 0 || fee > 100000) return { error: "Fee must be a whole number of rupees (0 for free)." };
  const capRaw = str(fd, "capacity", 10);
  const capacity = capRaw ? Number(capRaw) : null;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000)) return { error: "Capacity must be a whole number above 0 (or empty for unlimited)." };

  const mapUrl = opt(fd, "map_url", 500);
  if (mapUrl && !/^https?:\/\//i.test(mapUrl)) return { error: "The map link must start with https://" };

  const payload = {
    title,
    slug,
    summary: str(fd, "summary", 280),
    description: str(fd, "description", 20000),
    category,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    timezone: tz,
    venue: opt(fd, "venue", 200),
    location: opt(fd, "location", 300),
    map_url: mapUrl,
    is_online: fd.get("is_online") === "on",
    fee,
    capacity,
    registration_opens_at: opens?.toISOString() ?? null,
    registration_closes_at: closes?.toISOString() ?? null,
    is_featured: fd.get("is_featured") === "on",
    agenda: parseAgenda(str(fd, "agenda", 50000)),
    form_fields: parseFormFields(str(fd, "form_fields", 50000)),
    organizer_name: opt(fd, "organizer_name", 120),
    organizer_email: opt(fd, "organizer_email", 200),
    organizer_phone: opt(fd, "organizer_phone", 30),
  };

  // Existing event: capacity can't drop below the people already registered.
  let existing: { id: string; slug: string; status: string; cover_path: string | null; registered_count: number } | null = null;
  if (id) {
    const { data } = await supabase.from("events").select("id, slug, status, cover_path, registered_count").eq("id", id).maybeSingle();
    if (!data) return { error: "This event no longer exists." };
    existing = data;
    if (capacity !== null && capacity < data.registered_count)
      return { error: `Capacity can't be lower than the ${data.registered_count} people already registered.` };
  }

  // Unique URL: add -2, -3… if another event already uses it.
  const { data: clash } = await supabase.from("events").select("id, slug").like("slug", `${slug}%`);
  const taken = new Set((clash ?? []).filter((r) => r.id !== id).map((r) => r.slug));
  if (taken.has(slug)) {
    let n = 2;
    while (taken.has(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
    payload.slug = slug;
  }

  // Poster / cover upload (checked by its real bytes, max 5 MB).
  let coverPath = existing?.cover_path ?? null;
  const oldCover = coverPath;
  const cover = fd.get("cover");
  if (cover instanceof File && cover.size > 0) {
    const img = await sniffImage(cover, { maxBytes: 5 * 1024 * 1024 });
    if ("error" in img) return { error: `Poster: ${img.error}` };
    const path = `${crypto.randomUUID()}.${img.ext}`;
    const { error: upErr } = await supabase.storage.from("event-covers").upload(path, img.body, { contentType: img.type, upsert: false, cacheControl: "31536000" });
    if (upErr) {
      console.error("[admin] poster upload failed", upErr.message);
      return { error: "Couldn't upload the poster. Please try a smaller JPG, PNG or WebP image." };
    }
    coverPath = path;
  } else if (fd.get("remove_cover") === "on") {
    coverPath = null;
  }

  const status = intent === "publish" ? "published" : intent === "draft" ? "draft" : (existing?.status ?? "draft");
  const row = { ...payload, cover_path: coverPath, ...(existing?.status === "cancelled" && intent !== "publish" ? {} : { status }) };

  let savedId = id;
  if (existing) {
    const { error } = await supabase.from("events").update(row).eq("id", existing.id);
    if (error) return { error: friendlyDbError(error.message) };
  } else {
    const { data, error } = await supabase.from("events").insert(row).select("id").single();
    if (error) return { error: friendlyDbError(error.message) };
    savedId = data.id;
  }

  if (oldCover && oldCover !== coverPath) await supabase.storage.from("event-covers").remove([oldCover]);

  refreshPublic(slug);
  if (existing && existing.slug !== slug) revalidatePath(`/events/${existing.slug}`);
  redirect(`/admin/events/${savedId}?saved=1`);
}

function friendlyDbError(msg: string) {
  if (/events_slug_key|duplicate key/.test(msg)) return "Another event already uses this URL name. Change the URL name and save again.";
  if (/row-level security|permission denied/.test(msg)) return "Only admins can manage events.";
  if (/violates check constraint/.test(msg)) return "Some details aren't valid. Please check the dates, fee and capacity and try again.";
  console.error("[admin] event save failed", msg);
  return "Couldn't save the event. Please try again.";
}

// ---------------------------------------------------------------------------
// Status changes, delete
// ---------------------------------------------------------------------------
export async function setEventStatus(fd: FormData) {
  const admin = await getAdminClient();
  if (!admin) return;
  const id = str(fd, "id", 64);
  const status = str(fd, "status", 20);
  if (!["draft", "published", "cancelled"].includes(status)) return;
  const note = opt(fd, "note", 500);
  const patch: Record<string, unknown> = { status };
  if (status === "cancelled") patch.cancellation_note = note;
  if (status !== "cancelled") patch.cancellation_note = null;
  const { data, error } = await admin.supabase.from("events").update(patch).eq("id", id).select("slug").single();
  if (error) {
    console.error("[admin] action failed", error.message);
    throw new Error("Something went wrong while saving. Please refresh the page and try again.");
  }
  refreshPublic(data.slug);
}

export async function toggleFeatured(fd: FormData) {
  const admin = await getAdminClient();
  if (!admin) return;
  const id = str(fd, "id", 64);
  const { data, error } = await admin.supabase
    .from("events")
    .update({ is_featured: fd.get("featured") === "1" })
    .eq("id", id)
    .select("slug")
    .single();
  if (error) {
    console.error("[admin] action failed", error.message);
    throw new Error("Something went wrong while saving. Please refresh the page and try again.");
  }
  refreshPublic(data.slug);
}

export async function deleteEvent(_prev: EventFormState, fd: FormData): Promise<EventFormState> {
  const admin = await getAdminClient();
  if (!admin) return { error: "Only admins can delete events." };
  const id = str(fd, "id", 64);
  if (str(fd, "confirm", 20).toUpperCase() !== "DELETE") return { error: 'Type DELETE in the box to confirm.' };
  const { data: ev } = await admin.supabase.from("events").select("slug, cover_path").eq("id", id).maybeSingle();
  if (!ev) return { error: "This event no longer exists." };

  // Registrations' payment screenshots go too.
  const { data: regs } = await admin.supabase.from("event_registrations").select("proof_path").eq("event_id", id).not("proof_path", "is", null);
  const { error } = await admin.supabase.from("events").delete().eq("id", id);
  if (error) {
    console.error("[admin] delete event failed", error.message);
    return { error: "Couldn't delete the event. Please try again." };
  }
  if (ev.cover_path) await admin.supabase.storage.from("event-covers").remove([ev.cover_path]);
  const proofs = (regs ?? []).map((r) => r.proof_path as string).filter(Boolean);
  if (proofs.length) await admin.supabase.storage.from("event-payment-proofs").remove(proofs);

  refreshPublic(ev.slug);
  redirect("/admin/events?deleted=1");
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------
async function eventSlug(supabase: NonNullable<Awaited<ReturnType<typeof getAdminClient>>>["supabase"], eventId: string) {
  const { data } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  return data?.slug as string | undefined;
}

export async function reviewEventPayment(fd: FormData) {
  const admin = await getAdminClient();
  if (!admin) return;
  const { error } = await admin.supabase.rpc("admin_review_event_payment", {
    p_registration: str(fd, "id", 64),
    p_approve: fd.get("decision") === "approve",
    p_note: opt(fd, "note", 300),
  });
  if (error) {
    console.error("[admin] action failed", error.message);
    throw new Error("Something went wrong while saving. Please refresh the page and try again.");
  }
  refreshPublic(await eventSlug(admin.supabase, str(fd, "event_id", 64)));
}

export async function removeRegistration(fd: FormData) {
  const admin = await getAdminClient();
  if (!admin) return;
  const { error } = await admin.supabase.rpc("admin_cancel_event_registration", {
    p_registration: str(fd, "id", 64),
    p_note: opt(fd, "note", 300),
  });
  if (error) {
    console.error("[admin] action failed", error.message);
    throw new Error("Something went wrong while saving. Please refresh the page and try again.");
  }
  refreshPublic(await eventSlug(admin.supabase, str(fd, "event_id", 64)));
}

export async function addRegistration(_prev: AddRegistrationState, fd: FormData): Promise<AddRegistrationState> {
  const admin = await getAdminClient();
  if (!admin) return { error: "Only admins can add registrations." };
  const eventId = str(fd, "event_id", 64);
  const fullName = str(fd, "full_name", 100);
  const email = str(fd, "email", 200).toLowerCase();
  const phone = str(fd, "phone", 20);
  const age = Number(str(fd, "age", 3));
  if (fullName.length < 2) return { error: "Enter the participant's name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
  if (!/^\+?[0-9][0-9 -]{6,19}$/.test(phone)) return { error: "Enter a valid phone number." };
  if (!Number.isInteger(age) || age < 1 || age > 120) return { error: "Enter a valid age." };
  const { data, error } = await admin.supabase.rpc("admin_add_event_registration", {
    p_event: eventId,
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_age: age,
    p_note: opt(fd, "note", 300),
  });
  if (error) {
    const friendly = registrationErrorMessage(error.message);
    if (!friendly) console.error("[admin] add registration failed", error.message);
    return { error: friendly ?? "Couldn't add this person. Please try again." };
  }
  refreshPublic(await eventSlug(admin.supabase, eventId));
  return { code: String(data) };
}
