"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, Copy, ImageUp, Loader2, Smartphone } from "lucide-react";
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
  signedIn: boolean;
  prefill: { fullName: string; email: string; phone: string };
  existing: { code: string; status: string } | null;
  upi: { qrFiles: string[]; upiId: string; upiName: string };
};

type Done = { code: string; status: "confirmed" | "pending_payment" };

const CLOSED_COPY: Record<Exclude<RegistrationState, "open">, string> = {
  full: "All spots are taken. Keep an eye on our other events!",
  closed: "The registration deadline has passed.",
  not_open: "Registrations haven't opened yet — check back soon.",
  cancelled: "This event has been cancelled, so registrations are closed.",
  past: "This event has already happened. See you at the next one!",
};

export function RegistrationForm({ event, state, isDemo, signedIn, prefill, existing, upi }: Props) {
  const [done, setDone] = useState<Done | null>(existing ? { code: existing.code, status: existing.status as Done["status"] } : null);
  const [fullName, setFullName] = useState(prefill.fullName);
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState(prefill.phone);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [utr, setUtr] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrIndex, setQrIndex] = useState(0);
  const paid = event.fee > 0;
  const qrSrc = upi.qrFiles[qrIndex] ?? null;
  const upiLink = upi.upiId
    ? `upi://pay?pa=${encodeURIComponent(upi.upiId)}&pn=${encodeURIComponent(upi.upiName || "FemRise")}&am=${event.fee}&cu=INR&tn=${encodeURIComponent(event.title.slice(0, 40))}`
    : null;

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

  function pickProof(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Please upload an image (screenshot) of the payment.");
    if (f.size > 8 * 1024 * 1024) return setError("Screenshot must be under 8 MB.");
    setError(null);
    setProof(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isDemo) return setError("Registrations aren't connected yet — this is sample data. Connect Supabase to go live.");
    if (fullName.trim().length < 2) return setError("Please enter your full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (!/^\+?[0-9][0-9 -]{6,19}$/.test(phone.trim())) return setError("Please enter a valid phone number.");
    for (const f of event.formFields) {
      if (f.required && !(answers[f.id] ?? "").trim()) return setError(`Please fill in: ${f.label}.`);
    }
    if (paid) {
      if (!/^[A-Za-z0-9]{10,22}$/.test(utr.replace(/\s/g, ""))) return setError("Enter the 12-digit UPI transaction ID (UTR) shown in your payment app.");
      if (!proof) return setError("Please upload the payment screenshot.");
    }

    const body = new FormData();
    body.set("fullName", fullName.trim());
    body.set("email", email.trim());
    body.set("phone", phone.trim());
    body.set("answers", JSON.stringify(answers));
    if (paid) {
      body.set("utr", utr.replace(/\s/g, ""));
      if (proof) body.set("proof", proof);
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.slug)}/register`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { code?: string; status?: Done["status"]; error?: string };
      if (!res.ok || !json.code) throw new Error(json.error || "Something went wrong. Please try again.");
      setDone({ code: json.code, status: json.status ?? "confirmed" });
      window.scrollTo({ top: (document.getElementById("register")?.offsetTop ?? 0) - 100, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
              ? `Entry is ${feeLabel(event.fee)}. Pay by GPay / any UPI app, then add the transaction ID and screenshot. Your spot is held while we verify it.`
              : "It's free — just tell us who's coming."}
          </p>
          {!signedIn && (
            <p className="mt-4 text-[14px] text-fr-charcoal">
              Already part of Femrise?{" "}
              <Link href={`/login?next=/events/${event.slug}`} className="font-bold underline decoration-fr-yellow decoration-[3px] underline-offset-4">
                Log in
              </Link>{" "}
              to fill this in faster. Or register as a guest.
            </p>
          )}
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
            {event.formFields.map((f) => (
              <Field key={f.id} label={f.label} required={f.required} className={clsx((f.type === "textarea" || f.type === "checkbox") && "sm:col-span-2")}>
                <CustomInput field={f} value={answers[f.id] ?? ""} onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))} />
              </Field>
            ))}
          </div>

          {paid && (
            <div className="rounded-[14px] border-2 border-ink bg-fr-cream p-5">
              <p className="font-display text-lg font-bold">Pay {feeLabel(event.fee)} by UPI</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-[150px_1fr]">
                {qrSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrSrc} alt="UPI QR code" onError={() => setQrIndex((i) => i + 1)} className="w-[150px] rounded-[10px] border-2 border-ink bg-white p-1.5" />
                ) : (
                  <div className="flex h-[150px] w-[150px] items-center justify-center rounded-[10px] border-2 border-dashed border-ink bg-white p-3 text-center text-[12px] font-bold">
                    QR not added yet
                  </div>
                )}
                <div className="space-y-3 text-[14px]">
                  {upi.upiId && (
                    <button type="button" onClick={() => navigator.clipboard?.writeText(upi.upiId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {})} className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-3 py-1.5 font-mono font-bold">
                      {upi.upiId} {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                  {upiLink && (
                    <a href={upiLink} className="btn-yellow !px-5 !py-2.5 sm:hidden">
                      <Smartphone className="h-4 w-4" /> Pay with UPI app
                    </a>
                  )}
                  <p className="text-fr-charcoal">Scan with GPay, PhonePe or Paytm. Pay exactly {feeLabel(event.fee)}.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field label="UPI transaction ID (UTR)" required>
                  <input className="field font-mono" value={utr} onChange={(e) => setUtr(e.target.value)} inputMode="numeric" placeholder="12-digit number" maxLength={26} />
                </Field>
                <Field label="Payment screenshot" required>
                  <label className="field flex cursor-pointer items-center gap-2 !py-3">
                    <ImageUp className="h-5 w-5 shrink-0" />
                    <span className="truncate">{proof ? proof.name : "Choose image"}</span>
                    <input type="file" accept="image/*" onChange={pickProof} className="sr-only" />
                  </label>
                </Field>
              </div>
            </div>
          )}

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
              {busy ? "Registering…" : paid ? "Submit registration" : "Register now"}
            </button>
            {!busy && <Burst className="absolute -right-9 top-1/2 h-9 w-9 -translate-y-1/2" />}
          </span>
          <p className="text-[12px] text-fr-muted">Your details are only shared with the Femrise team running this event.</p>
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
  const pending = done.status === "pending_payment";
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="card-pop relative bg-fr-softgreen p-8 text-center sm:p-12">
      <span className="tape" aria-hidden />
      <CheckCircle2 className="mx-auto h-14 w-14" aria-hidden />
      <p className="h-display mt-4 text-4xl sm:text-5xl">{pending ? "Almost there!" : "You're in!"}</p>
      <p className="mx-auto mt-3 max-w-lg text-[16px]">
        {pending
          ? `We've received your registration for ${title}. Your spot is held while the team verifies your UPI payment.`
          : `You're registered for ${title}. See you there!`}
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
