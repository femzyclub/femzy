"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { Burst } from "@/components/doodle/Doodles";
import { feeLabel, REGISTRATION_LABEL } from "@/lib/events/shared";
import type { EventFormField, RegistrationState } from "@/lib/events/types";

type Props = {
  event: { id: string; slug: string; title: string; fee: number; formFields: EventFormField[] };
  state: RegistrationState;
  isDemo: boolean;
};

type Done = { code: string; status: "confirmed" };

type CashfreeCheckout = {
  checkout: (options: { paymentSessionId: string; redirectTarget: "_modal" }) => Promise<{ error?: { message?: string }; paymentDetails?: unknown; redirect?: boolean }>;
};
declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => CashfreeCheckout;
  }
}

function loadCashfreeCheckout() {
  if (window.Cashfree) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the Cashfree checkout. Please check your connection and try again."));
    document.head.appendChild(script);
  });
}

const CLOSED_COPY: Record<Exclude<RegistrationState, "open">, string> = {
  full: "All spots are taken. Keep an eye on our other events!",
  closed: "The registration deadline has passed.",
  not_open: "Registrations haven't opened yet — check back soon.",
  cancelled: "This event has been cancelled, so registrations are closed.",
  past: "This event has already happened. See you at the next one!",
};

export function RegistrationForm({ event, state, isDemo }: Props) {
  const [done, setDone] = useState<Done | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = event.fee > 0;

  if (done) return <Confirmation done={done} title={event.title} email={email} />;

  if (state !== "open") {
    return (
      <div className="card-pop bg-white p-8 text-center">
        <p className="h-display text-3xl">{REGISTRATION_LABEL[state]}</p>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-fr-charcoal">{CLOSED_COPY[state]}</p>
        <Link href="/events" className="btn-outline mt-6">
          Browse other events
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isDemo) return setError("Registrations aren't connected yet — this is sample data. Connect Supabase to go live.");
    if (fullName.trim().length < 2) return setError("Please enter your full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (!/^\+?[0-9][0-9 -]{6,19}$/.test(phone.trim())) return setError("Please enter a valid phone number.");
    if (!Number.isInteger(Number(age)) || Number(age) < 1 || Number(age) > 120) return setError("Please enter a valid age.");
    for (const f of event.formFields) {
      if (f.required && !(answers[f.id] ?? "").trim()) return setError(`Please fill in: ${f.label}.`);
    }
    const body = new FormData();
    body.set("fullName", fullName.trim());
    body.set("email", email.trim());
    body.set("phone", phone.trim());
    body.set("age", age);
    body.set("answers", JSON.stringify(answers));
    setBusy(true);
    try {
      if (paid) {
        const orderRes = await fetch(`/api/events/${encodeURIComponent(event.slug)}/cashfree-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), age: Number(age), answers }),
        });
        const order = (await orderRes.json().catch(() => ({}))) as { registrationId?: string; paymentSessionId?: string; environment?: "sandbox" | "production"; error?: string };
        if (!orderRes.ok || !order.registrationId || !order.paymentSessionId || !order.environment) throw new Error(order.error || "Couldn't begin the payment. Please try again.");
        await loadCashfreeCheckout();
        if (!window.Cashfree) throw new Error("Cashfree checkout could not start. Please try again.");
        const result = await window.Cashfree({ mode: order.environment }).checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: "_modal" });
        // Cashfree's own error text can be technical, so show a plain message instead.
        if (result.error) throw new Error("The payment was not completed. You can try again.");

        const verifyRes = await fetch(`/api/events/${encodeURIComponent(event.slug)}/cashfree-verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId: order.registrationId }),
        });
        const verified = (await verifyRes.json().catch(() => ({}))) as { code?: string; error?: string };
        if (!verifyRes.ok || !verified.code) throw new Error(verified.error || "Payment is still being confirmed. Please check your email or contact Femzy with your payment details.");
        setDone({ code: verified.code, status: "confirmed" });
        window.scrollTo({ top: (document.getElementById("register")?.offsetTop ?? 0) - 100, behavior: "smooth" });
        return;
      }
      const res = await fetch(`/api/events/${encodeURIComponent(event.slug)}/register`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { code?: string; status?: Done["status"]; error?: string };
      if (!res.ok || !json.code) throw new Error(json.error || "Something went wrong. Please try again.");
      setDone({ code: json.code, status: json.status ?? "confirmed" });
      window.scrollTo({ top: (document.getElementById("register")?.offsetTop ?? 0) - 100, behavior: "smooth" });
    } catch (err) {
      // fetch() throws a TypeError ("Failed to fetch") when the connection drops.
      if (err instanceof TypeError) setError("We couldn't reach the server. Please check your internet connection and try again.");
      else setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-pop relative bg-white p-6 sm:p-10">
      <span className="tape" aria-hidden />
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <span className="eyebrow">Register</span>
          <h2 className="h-display mt-4 text-4xl sm:text-5xl">
            Save your <span className="font-hand font-normal text-fr-blue">spot!</span>
          </h2>
          <p className="mt-4 text-[15px] text-fr-charcoal">
            {paid
              ? `Entry is ${feeLabel(event.fee)}. Complete payment securely with Cashfree to confirm your spot.`
              : "It's free — just tell us who's coming."}
          </p>
          <p className="mt-4 text-[14px] text-fr-charcoal">No account needed — complete this form and you&apos;re registered.</p>
        </div>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" required className="sm:col-span-2">
              <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={100} required />
            </Field>
            <Field label="Email" required>
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={200} required />
            </Field>
            <Field label="Phone" required>
              <input className="field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="98765 43210" maxLength={20} required />
            </Field>
            <Field label="Age" required>
              <input className="field" type="number" value={age} onChange={(e) => setAge(e.target.value)} min={1} max={120} inputMode="numeric" required />
            </Field>
            {event.formFields.map((f) => (
              <Field key={f.id} label={f.label} required={f.required} className={clsx((f.type === "textarea" || f.type === "checkbox") && "sm:col-span-2")}>
                <CustomInput field={f} value={answers[f.id] ?? ""} onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))} />
              </Field>
            ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="rounded-[10px] border-2 border-fr-red bg-white px-4 py-3 text-[14px] font-bold text-fr-red">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <span className="relative inline-flex">
            <button type="submit" disabled={busy} className="btn-primary disabled:opacity-70">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {busy ? "Preparing payment…" : paid ? `Pay ${feeLabel(event.fee)} securely` : "Register now"}
            </button>
            {!busy && <Burst className="absolute -right-9 top-1/2 h-9 w-9 -translate-y-1/2" />}
          </span>
          <p className="text-[12px] text-fr-muted">Your details are only shared with the Femzy team running this event.</p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <span className="label-field">
        {label}
        {required && <span className="text-fr-red"> *</span>}
      </span>
      {children}
    </div>
  );
}

function CustomInput({ field, value, onChange }: { field: EventFormField; value: string; onChange: (v: string) => void }) {
  const aria = { "aria-label": field.label };
  switch (field.type) {
    case "textarea":
      return <textarea {...aria} className="field min-h-[110px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} maxLength={1000} />;
    case "number":
      return <input {...aria} type="number" className="field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
    case "select":
      return (
        <select {...aria} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <label className="flex cursor-pointer items-center gap-3 text-[15px]">
          <input type="checkbox" checked={value === "Yes"} onChange={(e) => onChange(e.target.checked ? "Yes" : "")} className="h-5 w-5 accent-[#0B0B0B]" />
          {field.placeholder || "Yes"}
        </label>
      );
    default:
      return <input {...aria} className="field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} maxLength={300} />;
  }
}

function Confirmation({ done, title, email }: { done: Done; title: string; email: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="card-pop relative bg-fr-softgreen p-8 text-center sm:p-12">
      <span className="tape" aria-hidden />
      <CheckCircle2 className="mx-auto h-14 w-14" aria-hidden />
      <p className="h-display mt-4 text-4xl sm:text-5xl">You&apos;re in!</p>
      <p className="mx-auto mt-3 max-w-lg text-[16px]">
        You&apos;re registered for {title}. See you there!
      </p>
      <div className="mx-auto mt-6 inline-block rounded-[12px] border-2 border-ink bg-white px-6 py-4 shadow-pop-sm">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-fr-muted">Registration ID</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{done.code}</p>
      </div>
      <p className="mx-auto mt-5 max-w-md text-[13px] text-fr-charcoal">
        Screenshot or note this ID — show it at the venue{email ? ` and use ${email} if the team needs to find your registration` : ""}.
      </p>
      <Link href="/events" className="btn-outline mt-6">
        More events
      </Link>
    </motion.div>
  );
}
