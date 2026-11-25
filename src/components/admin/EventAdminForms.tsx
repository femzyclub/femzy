"use client";

import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useActionState, useRef, useEffect } from "react";
import { addRegistration, deleteEvent, type AddRegistrationState, type EventFormState } from "@/app/admin/events/actions";

/** Delete with confirmation: the admin must type DELETE. */
export function DeleteEventForm({ id, title, registrations }: { id: string; title: string; registrations: number }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(deleteEvent, undefined);
  return (
    <details className="group rounded-[14px] border-2 border-fr-red bg-white p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-fr-red">
        <Trash2 className="h-4 w-4" /> Delete event
      </summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={id} />
        <p className="text-[14px]">
          This permanently deletes <b>{title}</b>
          {registrations > 0 ? ` and its ${registrations} registration${registrations === 1 ? "" : "s"}` : ""}. It can&apos;t be undone. To hide it instead, unpublish or cancel it.
        </p>
        <label className="block">
          <span className="label-field">Type DELETE to confirm</span>
          <input name="confirm" className="field" autoComplete="off" placeholder="DELETE" />
        </label>
        {state?.error && <p className="text-[14px] font-bold text-fr-red">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn !py-2.5 bg-fr-red text-white disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Delete permanently
        </button>
      </form>
    </details>
  );
}

/** Manually add a participant (e.g. paid in cash). Capacity is still enforced by the database. */
export function AddRegistrationForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<AddRegistrationState, FormData>(addRegistration, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.code) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_100px_auto] sm:items-end">
      <input type="hidden" name="event_id" value={eventId} />
      <label>
        <span className="label-field">Name</span>
        <input name="full_name" className="field !py-2.5" required maxLength={100} />
      </label>
      <label>
        <span className="label-field">Email</span>
        <input name="email" type="email" className="field !py-2.5" required maxLength={200} />
      </label>
      <label>
        <span className="label-field">Phone</span>
        <input name="phone" type="tel" className="field !py-2.5" required maxLength={20} />
      </label>
      <label>
        <span className="label-field">Age</span>
        <input name="age" type="number" className="field !py-2.5" required min={1} max={120} />
      </label>
      <button type="submit" disabled={pending} className="btn-primary !py-2.5 disabled:opacity-60">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add
      </button>
      <input name="note" className="field !py-2.5 sm:col-span-3" placeholder="Note (optional), e.g. paid cash at the desk" maxLength={300} />
      <div className="sm:col-span-5">
        {state?.error && <p className="text-[14px] font-bold text-fr-red">{state.error}</p>}
        {state?.code && (
          <p className="text-[14px] font-bold">
            Added · registration ID <span className="font-mono">{state.code}</span>
          </p>
        )}
      </div>
    </form>
  );
}
