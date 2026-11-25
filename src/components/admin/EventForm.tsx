"use client";

import { ArrowDown, ArrowUp, ImageUp, Loader2, Plus, Trash2 } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import clsx from "clsx";
import { saveEvent, type EventFormState } from "@/app/admin/events/actions";
import { slugify } from "@/lib/events/shared";
import { EVENT_CATEGORIES, FORM_FIELD_TYPES, type AgendaItem, type EventFormField } from "@/lib/events/types";

export type EventFormValues = {
  id?: string;
  status?: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  category: string;
  coverUrl: string | null;
  startsAt: string; // "YYYY-MM-DDTHH:mm" IST
  endsAt: string;
  venue: string;
  location: string;
  mapUrl: string;
  isOnline: boolean;
  fee: number;
  capacity: number | null;
  registrationOpensAt: string;
  registrationClosesAt: string;
  isFeatured: boolean;
  agenda: AgendaItem[];
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  formFields: EventFormField[];
  registeredCount?: number;
};

type FieldDraft = Omit<EventFormField, "options"> & { options: string };

export function EventForm({ initial }: { initial: EventFormValues }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(saveEvent, undefined);
  const editing = Boolean(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(editing);
  const [fee, setFee] = useState(String(initial.fee ?? 0));
  const [agenda, setAgenda] = useState<AgendaItem[]>(initial.agenda);
  const [fields, setFields] = useState<FieldDraft[]>(initial.formFields.map((f) => ({ ...f, options: (f.options ?? []).join(", ") })));
  const [preview, setPreview] = useState<string | null>(initial.coverUrl);
  const [removeCover, setRemoveCover] = useState(false);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  useEffect(() => {
    if (state?.error) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state]);

  function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    setRemoveCover(false);
  }

  const move = <T,>(list: T[], i: number, d: number) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return list;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  return (
    <form
      // Submit manually so React doesn't reset the form when the server sends back a validation error.
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => action(fd));
      }}
      className="space-y-8"
    >
      {state?.error && (
        <p role="alert" className="rounded-[10px] border-2 border-fr-red bg-white px-4 py-3 font-bold text-fr-red">
          {state.error}
        </p>
      )}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="agenda" value={JSON.stringify(agenda)} />
      <input
        type="hidden"
        name="form_fields"
        value={JSON.stringify(fields.map((f) => ({ ...f, options: f.type === "select" ? f.options.split(",").map((o) => o.trim()).filter(Boolean) : undefined })))}
      />

      <Card title="Basics">
        <div className="grid gap-5 sm:grid-cols-2">
          <L label="Event title" required className="sm:col-span-2">
            <input name="title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </L>
          <L label="URL" hint={`femzy…/events/${slug || "your-event"}`}>
            <input
              name="slug"
              className="field font-mono"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              maxLength={80}
            />
          </L>
          <L label="Category" required>
            <select name="category" className="field" defaultValue={initial.category || "Meetup"}>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </L>
          <L label="Short description" hint="Shown on event cards (max 280 characters)" className="sm:col-span-2">
            <textarea name="summary" className="field min-h-[80px]" defaultValue={initial.summary} maxLength={280} />
          </L>
          <L label="Full description" className="sm:col-span-2">
            <textarea name="description" className="field min-h-[180px]" defaultValue={initial.description} />
          </L>
          <label className="flex items-center gap-3 text-[15px] font-bold">
            <input type="checkbox" name="is_featured" defaultChecked={initial.isFeatured} className="h-5 w-5 accent-[#0B0B0B]" /> Feature this event
          </label>
        </div>
      </Card>

      <Card title="Poster / cover image">
        <div className="grid gap-5 sm:grid-cols-[260px_1fr]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[10px] border-2 border-ink bg-fr-cream">
            {preview && !removeCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Poster preview" className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-fr-muted">No image</span>
            )}
          </div>
          <div className="space-y-3">
            <label className="btn-outline cursor-pointer !py-2.5">
              <ImageUp className="h-5 w-5" /> {initial.coverUrl ? "Replace image" : "Upload image"}
              <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" onChange={onCover} className="sr-only" />
            </label>
            <p className="text-[13px] text-fr-muted">JPG, PNG or WEBP, up to 5 MB. Wide images (16:9) look best.</p>
            {initial.coverUrl && (
              <label className="flex items-center gap-2 text-[14px] font-bold">
                <input type="checkbox" name="remove_cover" checked={removeCover} onChange={(e) => setRemoveCover(e.target.checked)} className="h-4 w-4 accent-[#0B0B0B]" /> Remove current image
              </label>
            )}
          </div>
        </div>
      </Card>

      <Card title="Date, time & place" note="All times are India Standard Time (IST).">
        <div className="grid gap-5 sm:grid-cols-2">
          <L label="Starts" required>
            <input type="datetime-local" name="starts_at" className="field" defaultValue={initial.startsAt} required />
          </L>
          <L label="Ends" required>
            <input type="datetime-local" name="ends_at" className="field" defaultValue={initial.endsAt} required />
          </L>
          <L label="Venue">
            <input name="venue" className="field" defaultValue={initial.venue} placeholder="e.g. KBR Park, Gate 1" maxLength={200} />
          </L>
          <L label="Location / address">
            <input name="location" className="field" defaultValue={initial.location} placeholder="Area, city" maxLength={300} />
          </L>
          <L label="Google Maps link">
            <input name="map_url" type="url" className="field" defaultValue={initial.mapUrl} placeholder="https://maps.app.goo.gl/…" maxLength={500} />
          </L>
          <label className="flex items-center gap-3 self-end pb-3 text-[15px] font-bold">
            <input type="checkbox" name="is_online" defaultChecked={initial.isOnline} className="h-5 w-5 accent-[#0B0B0B]" /> Online event
          </label>
        </div>
      </Card>

      <Card title="Registration">
        <div className="grid gap-5 sm:grid-cols-2">
          <L label="Registration fee (₹)" hint="0 = free. Paid registrations use Razorpay Checkout and are confirmed automatically after payment.">
            <input type="number" name="fee" min={0} max={100000} step={1} className="field" value={fee} onChange={(e) => setFee(e.target.value)} />
          </L>
          <L
            label="Maximum participants"
            hint={initial.registeredCount ? `Leave empty for unlimited. ${initial.registeredCount} already registered.` : "Leave empty for unlimited."}
          >
            <input type="number" name="capacity" min={Math.max(1, initial.registeredCount ?? 0)} step={1} className="field" defaultValue={initial.capacity ?? ""} />
          </L>
          <L label="Registrations open" hint="Empty = as soon as it's published">
            <input type="datetime-local" name="registration_opens_at" className="field" defaultValue={initial.registrationOpensAt} />
          </L>
          <L label="Registration deadline" hint="Empty = when the event starts">
            <input type="datetime-local" name="registration_closes_at" className="field" defaultValue={initial.registrationClosesAt} />
          </L>
        </div>
      </Card>

      <Card title="Extra registration questions" note="Name, email, phone and age are always asked. Add any event-specific details you need.">
        {fields.length === 0 && <p className="text-[14px] text-fr-muted">No extra questions.</p>}
        <ul className="space-y-4">
          {fields.map((f, i) => (
            <li key={i} className="rounded-[10px] border-2 border-ink bg-fr-warm p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
                <input
                  aria-label="Question"
                  className="field"
                  placeholder="Question, e.g. T-shirt size"
                  value={f.label}
                  onChange={(e) => setFields((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <select
                  aria-label="Answer type"
                  className="field"
                  value={f.type}
                  onChange={(e) => setFields((l) => l.map((x, j) => (j === i ? { ...x, type: e.target.value as FieldDraft["type"] } : x)))}
                >
                  {FORM_FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {{ text: "Short text", textarea: "Long text", number: "Number", select: "Dropdown", checkbox: "Yes / no" }[t]}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <IconBtn label="Move up" onClick={() => setFields((l) => move(l, i, -1))}>
                    <ArrowUp className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="Move down" onClick={() => setFields((l) => move(l, i, 1))}>
                    <ArrowDown className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="Remove question" onClick={() => setFields((l) => l.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {f.type === "select" && (
                  <input
                    aria-label="Dropdown options"
                    className="field flex-1"
                    placeholder="Options, separated by commas: S, M, L, XL"
                    value={f.options}
                    onChange={(e) => setFields((l) => l.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))}
                  />
                )}
                <label className="flex items-center gap-2 text-[14px] font-bold">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => setFields((l) => l.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))}
                    className="h-4 w-4 accent-[#0B0B0B]"
                  />
                  Required
                </label>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setFields((l) => [...l, { id: "", label: "", type: "text", required: false, options: "" }])}
          className="btn-outline mt-4 !py-2.5"
        >
          <Plus className="h-4 w-4" /> Add question
        </button>
      </Card>

      <Card title="Schedule / agenda" note="Optional. Shown as a timeline on the event page.">
        <ul className="space-y-3">
          {agenda.map((a, i) => (
            <li key={i} className="grid gap-3 rounded-[10px] border-2 border-ink bg-fr-warm p-3 sm:grid-cols-[130px_1fr_auto]">
              <input aria-label="Time" className="field" placeholder="7:00 AM" value={a.time} onChange={(e) => setAgenda((l) => l.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
              <div className="space-y-2">
                <input aria-label="Agenda item" className="field" placeholder="What happens" value={a.title} onChange={(e) => setAgenda((l) => l.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <input
                  aria-label="Details"
                  className="field"
                  placeholder="Details (optional)"
                  value={a.description ?? ""}
                  onChange={(e) => setAgenda((l) => l.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                />
              </div>
              <div className="flex items-start gap-1">
                <IconBtn label="Move up" onClick={() => setAgenda((l) => move(l, i, -1))}>
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn label="Move down" onClick={() => setAgenda((l) => move(l, i, 1))}>
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
                <IconBtn label="Remove" onClick={() => setAgenda((l) => l.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setAgenda((l) => [...l, { time: "", title: "" }])} className="btn-outline mt-4 !py-2.5">
          <Plus className="h-4 w-4" /> Add agenda item
        </button>
      </Card>

      <Card title="Organiser" note="Shown publicly on the event page.">
        <div className="grid gap-5 sm:grid-cols-3">
          <L label="Name">
            <input name="organizer_name" className="field" defaultValue={initial.organizerName} placeholder="Femzy" maxLength={120} />
          </L>
          <L label="Email">
            <input name="organizer_email" type="email" className="field" defaultValue={initial.organizerEmail} maxLength={200} />
          </L>
          <L label="Phone">
            <input name="organizer_phone" className="field" defaultValue={initial.organizerPhone} maxLength={30} />
          </L>
        </div>
      </Card>

      <div className="sticky bottom-0 z-20 -mx-5 flex flex-wrap items-center gap-3 border-t-2 border-ink bg-fr-warm px-5 py-4 sm:mx-0 sm:rounded-[14px] sm:border-2">
        {initial.status === "published" ? (
          <Submit intent="save" label="Save changes" primary pending={pending} />
        ) : (
          <>
            <Submit intent="publish" label={initial.status === "cancelled" ? "Save & re-publish" : "Publish"} primary pending={pending} />
            <Submit intent={initial.status === "cancelled" ? "save" : "draft"} label={initial.status === "cancelled" ? "Save (keep cancelled)" : "Save as draft"} pending={pending} />
          </>
        )}
        {initial.status === "published" && <Submit intent="draft" label="Save & unpublish" pending={pending} />}
        <span className="text-[13px] text-fr-muted">{Number(fee) > 0 ? "Paid event · Razorpay Checkout" : "Free event"}</span>
      </div>
    </form>
  );
}

function Submit({ intent, label, primary, pending }: { intent: string; label: string; primary?: boolean; pending: boolean }) {
  return (
    <button type="submit" name="intent" value={intent} disabled={pending} className={clsx(primary ? "btn-primary" : "btn-outline", "!py-2.5 disabled:opacity-60")}>
      {pending && primary ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </button>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card-pop bg-white p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {note && <p className="mt-1 text-[13px] text-fr-muted">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function L({ label, hint, required, className, children }: { label: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label-field">
        {label}
        {required && <span className="text-fr-red"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-fr-muted">{hint}</span>}
    </label>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-white hover:bg-fr-cream">
      {children}
    </button>
  );
}
