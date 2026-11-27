import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { Download, ExternalLink, Pencil, Search } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { DeleteEventForm } from "@/components/admin/EventAdminForms";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CategoryChip } from "@/components/events/EventBits";
import { requireAdmin } from "@/lib/admin";
import { mapEvent, type EventRow } from "@/lib/events/data";
import { feeLabel, REGISTRATION_LABEL, registrationState } from "@/lib/events/shared";
import { formatDateTime, formatRange } from "@/lib/events/time";
import type { EventRegistrationRow } from "@/lib/events/types";
import { removeRegistration, setEventStatus, toggleFeatured } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage event — Femzy admin", robots: { index: false } };

const FILTERS = [
  ["active", "Registered"],
  ["confirmed", "Confirmed"],
  ["pending_payment", "Payment in progress"],
  ["cancelled", "Removed / rejected"],
  ["all", "All"],
] as const;
type Filter = (typeof FILTERS)[number][0];

const REG_STATUS: Record<string, [string, string]> = {
  confirmed: ["Confirmed", "bg-fr-softgreen"],
  pending_payment: ["Payment in progress", "bg-fr-orange"],
  cancelled: ["Removed", "bg-white text-fr-muted"],
};

export default async function ManageEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string; saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(`/admin/events/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: row } = await supabase.from("events").select("*").eq("id", id).maybeSingle<EventRow>();
  if (!row) notFound();
  const e = mapEvent(row);
  const now = Date.now();
  const state = registrationState(e, now);

  const filter: Filter = FILTERS.some(([k]) => k === sp.status) ? (sp.status as Filter) : "active";
  const q = (sp.q ?? "").replace(/[,()*%\\]/g, " ").trim().slice(0, 80);

  let query = supabase.from("event_registrations").select("*").eq("event_id", e.id).order("created_at", { ascending: false }).limit(2000);
  if (filter === "active") query = query.in("status", ["confirmed", "pending_payment"]);
  else if (filter !== "all") query = query.eq("status", filter);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,registration_code.ilike.%${q}%,utr.ilike.%${q}%`);

  const [{ data: regsData }, { data: counts }] = await Promise.all([
    query,
    supabase.from("event_registrations").select("status").eq("event_id", e.id),
  ]);
  const regs = (regsData ?? []) as EventRegistrationRow[];
  const tally = { confirmed: 0, pending_payment: 0, cancelled: 0 } as Record<string, number>;
  for (const c of counts ?? []) tally[c.status as string] = (tally[c.status as string] ?? 0) + 1;

  const proofPaths = regs.map((r) => r.proof_path).filter((p): p is string => Boolean(p));
  const { data: signed } = proofPaths.length
    ? await supabase.storage.from("event-payment-proofs").createSignedUrls(proofPaths, 60 * 60)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const proofUrl = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const left = e.capacity == null ? null : Math.max(0, e.capacity - e.registeredCount);
  const exportHref = `/admin/events/${e.id}/export?status=${filter}`;

  return (
    <div className="min-h-screen pb-20">
      <AdminHeader active="events" />
      <main className="container-x pt-8">
        <Link href="/admin/events" className="text-[14px] font-bold underline decoration-fr-yellow decoration-[3px] underline-offset-4">
          ← All events
        </Link>

        {sp.saved && <p className="mt-4 rounded-[10px] border-2 border-ink bg-fr-softgreen p-3 font-bold">Saved. {e.status === "published" ? "It's live on the website and calendar." : ""}</p>}

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge e={e} now={now} />
              <CategoryChip category={e.category} />
              {e.status === "published" && <span className="text-[13px] font-bold text-fr-muted">{REGISTRATION_LABEL[state]}</span>}
            </div>
            <h1 className="h-display mt-3 text-4xl sm:text-5xl">{e.title}</h1>
            <p className="mt-2 text-[15px] text-fr-charcoal">
              {formatRange(e.startsAt, e.endsAt, e.timezone)} IST · {[e.venue, e.location].filter(Boolean).join(", ") || (e.isOnline ? "Online" : "Venue TBA")} · {feeLabel(e.fee)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/events/${e.id}/edit`} className="btn-yellow !px-5 !py-2.5">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
            {e.status !== "draft" && (
              <Link href={`/events/${e.slug}`} target="_blank" className="btn-outline !px-5 !py-2.5">
                <ExternalLink className="h-4 w-4" /> Public page
              </Link>
            )}
          </div>
        </div>

        {/* Event stats */}
        <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Box label="Registered" value={e.registeredCount} sub={e.capacity ? `of ${e.capacity}` : "no limit"} tone="bg-fr-yellow" />
          <Box label="Seats left" value={left ?? "∞"} />
          <Box label="Confirmed" value={tally.confirmed ?? 0} tone="bg-fr-softgreen" />
          <Box label="Payment sessions" value={tally.pending_payment ?? 0} tone={(tally.pending_payment ?? 0) > 0 ? "bg-fr-orange" : "bg-white"} />
        </section>

        {/* Publish / cancel / feature */}
        <section className="card-pop mt-6 grid gap-5 bg-white p-5 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-wrap items-center gap-2">
            {e.status !== "published" && (
              <form action={setEventStatus}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="status" value="published" />
                <button className="btn-primary !px-5 !py-2.5">{e.status === "cancelled" ? "Restore & publish" : "Publish"}</button>
              </form>
            )}
            {e.status === "published" && (
              <form action={setEventStatus}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="status" value="draft" />
                <button className="btn-outline !px-5 !py-2.5">Unpublish</button>
              </form>
            )}
            <form action={toggleFeatured}>
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="featured" value={e.isFeatured ? "0" : "1"} />
              <button className="btn-outline !px-5 !py-2.5">{e.isFeatured ? "Remove from featured" : "Feature"}</button>
            </form>
          </div>
          {e.status !== "cancelled" ? (
            <form action={setEventStatus} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="status" value="cancelled" />
              <input name="note" className="field min-w-[200px] flex-1 !py-2.5" placeholder="Cancellation note shown to visitors (optional)" maxLength={500} />
              <button className="btn-outline !px-5 !py-2.5 !text-fr-red">Cancel event</button>
            </form>
          ) : (
            <p className="text-[14px] font-bold text-fr-red">Cancelled{e.cancellationNote ? ` — “${e.cancellationNote}”` : ""}. It stays visible as cancelled; registrations are closed.</p>
          )}
        </section>

        {/* Registrations */}
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="h-display text-3xl">Participants</h2>
            <a href={exportHref} className="btn-outline !px-5 !py-2.5">
              <Download className="h-4 w-4" /> Export CSV / Excel
            </a>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex flex-wrap gap-2">
              {FILTERS.map(([k, label]) => (
                <Link
                  key={k}
                  href={`/admin/events/${e.id}?status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={clsx("rounded-full border-2 border-ink px-4 py-1.5 text-[14px] font-bold", filter === k ? "bg-ink text-white" : "bg-white hover:bg-fr-cream")}
                >
                  {label}
                  {k === "pending_payment" && (tally.pending_payment ?? 0) > 0 && <span className="ml-2 rounded-full bg-fr-yellow px-2 text-ink">{tally.pending_payment}</span>}
                </Link>
              ))}
            </nav>
            <form className="relative w-full lg:max-w-sm" action={`/admin/events/${e.id}`}>
              <input type="hidden" name="status" value={filter} />
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fr-muted" />
              <input name="q" defaultValue={q} className="field !py-2.5 !pl-10" placeholder="Search name, email, phone, ID, UTR" />
            </form>
          </div>

          {regs.length === 0 ? (
            <p className="card-pop mt-6 bg-white p-6 text-center font-bold">{q ? "No one matches that search." : "No registrations here yet."}</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {regs.map((r) => {
                const [label, cls] = REG_STATUS[r.status] ?? ["—", "bg-white"];
                const proof = r.proof_path ? proofUrl.get(r.proof_path) : null;
                const answers = e.formFields.filter((f) => r.answers?.[f.id]);
                return (
                  <li key={r.id} className={clsx("card-pop grid gap-4 bg-white p-4 sm:p-5", proof && "md:grid-cols-[1fr_150px]")}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-lg font-bold">{r.full_name}</p>
                        <span className={clsx("rounded-full border-2 border-ink px-2 py-0.5 text-[12px] font-bold", cls)}>{label}</span>
                        {r.source === "admin" && <span className="text-[12px] font-bold text-fr-muted">added by admin</span>}
                        {r.user_id && <span className="text-[12px] font-bold text-fr-blue">member</span>}
                      </div>
                      <p className="mt-1 break-all text-[14px] text-fr-charcoal">
                        <a href={`mailto:${r.email}`} className="hover:underline">
                          {r.email}
                        </a>{" "}
                        ·{" "}
                        <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="hover:underline">
                          {r.phone}
                        </a>
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
                        <Dt label="Registration ID">
                          <span className="font-mono">{r.registration_code}</span>
                        </Dt>
                        <Dt label="Registered">{formatDateTime(r.created_at)}</Dt>
                        <Dt label="Age">{r.age}</Dt>
                        {r.amount > 0 && <Dt label="Amount">₹{r.amount}</Dt>}
                        {r.utr && (
                          <Dt label="UTR">
                            <span className="break-all font-mono">{r.utr}</span>
                          </Dt>
                        )}
                        {answers.map((f) => (
                          <Dt key={f.id} label={f.label}>
                            {r.answers[f.id]}
                          </Dt>
                        ))}
                      </dl>
                      {r.admin_note && <p className="mt-2 text-[13px] text-fr-muted">Note: {r.admin_note}</p>}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {r.status === "pending_payment" && <p className="text-[13px] font-bold text-fr-charcoal">Awaiting Cashfree payment. Unfinished checkout sessions expire automatically.</p>}
                        {r.status === "confirmed" && (
                          <form action={removeRegistration}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="event_id" value={e.id} />
                            <button className="rounded-full border-2 border-ink px-4 py-1.5 text-[13px] font-bold hover:bg-fr-cream">Remove from event</button>
                          </form>
                        )}
                      </div>
                    </div>
                    {proof && (
                      <a href={proof} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={proof} alt="Payment screenshot" className="max-h-56 w-full rounded-[10px] border-2 border-ink object-contain" />
                        <span className="mt-1 block text-center text-[12px] font-bold underline">Open full size</span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-10 max-w-xl">
          <DeleteEventForm id={e.id} title={e.title} registrations={e.registeredCount} />
        </section>
      </main>
    </div>
  );
}

function Box({ label, value, sub, tone = "bg-white" }: { label: string; value: number | string; sub?: string; tone?: string }) {
  return (
    <div className={clsx("card-pop px-4 py-3", tone)}>
      <p className="h-display text-3xl tabular-nums">
        {value}
        {sub && <span className="ml-1 font-sans text-[14px] font-bold text-fr-charcoal">{sub}</span>}
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]">{label}</p>
    </div>
  );
}

function Dt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-fr-muted">{label}</dt>
      <dd className="font-bold">{children}</dd>
    </div>
  );
}
