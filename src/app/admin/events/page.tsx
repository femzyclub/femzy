import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CategoryChip } from "@/components/events/EventBits";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireAdmin } from "@/lib/admin";
import { mapEvent, type EventRow } from "@/lib/events/data";
import { feeLabel } from "@/lib/events/shared";
import { formatDateTime } from "@/lib/events/time";
import type { EventItem } from "@/lib/events/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events — Femrise! admin", robots: { index: false } };

const TABS = [
  ["all", "All"],
  ["upcoming", "Upcoming"],
  ["draft", "Drafts"],
  ["past", "Completed"],
  ["cancelled", "Cancelled"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ tab?: string; deleted?: string }> }) {
  const { supabase } = await requireAdmin("/admin/events");
  const sp = await searchParams;
  const tab: Tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as Tab) : "all";

  const [{ data, error }, { count: pendingPayments }] = await Promise.all([
    supabase.from("events").select("*").order("starts_at", { ascending: false }).limit(1000),
    supabase.from("event_registrations").select("id", { count: "exact", head: true }).eq("status", "pending_payment"),
  ]);
  const events: EventItem[] = ((data ?? []) as EventRow[]).map(mapEvent);
  const now = Date.now();
  const isUpcoming = (e: EventItem) => e.status === "published" && new Date(e.endsAt).getTime() >= now;
  const isPast = (e: EventItem) => e.status === "published" && new Date(e.endsAt).getTime() < now;

  // ---- analytics ----
  const upcoming = events.filter(isUpcoming);
  const completed = events.filter(isPast);
  const totalRegs = events.reduce((s, e) => s + e.registeredCount, 0);
  const remaining = upcoming.reduce((s, e) => s + (e.capacity == null ? 0 : Math.max(0, e.capacity - e.registeredCount)), 0);
  const unlimited = upcoming.some((e) => e.capacity == null);
  const popular = [...events].filter((e) => e.status !== "draft" && e.registeredCount > 0).sort((a, b) => b.registeredCount - a.registeredCount).slice(0, 5);
  const maxRegs = popular[0]?.registeredCount ?? 1;

  const shown = events.filter((e) =>
    tab === "all" ? true : tab === "upcoming" ? isUpcoming(e) : tab === "past" ? isPast(e) : e.status === tab,
  );
  if (tab === "upcoming") shown.reverse();

  return (
    <div className="min-h-screen pb-20">
      <AdminHeader active="events" />
      <main className="container-x pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="h-display text-4xl sm:text-5xl">Event management</h1>
            <p className="mt-2 text-[15px] text-fr-charcoal">Create events, manage registrations and see how each one is doing. Changes go live on the website instantly.</p>
          </div>
          <Link href="/admin/events/new" className="btn-primary">
            <Plus className="h-5 w-5" /> New event
          </Link>
        </div>

        {error && <p className="mt-6 rounded-[10px] border-2 border-fr-red bg-white p-4 font-bold text-fr-red">Couldn&apos;t load events: {error.message}. Did you run supabase/migrations/004_events.sql?</p>}
        {sp.deleted && <p className="mt-6 rounded-[10px] border-2 border-ink bg-fr-softgreen p-3 font-bold">Event deleted.</p>}

        {/* Analytics */}
        <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" aria-label="Event analytics">
          <Stat label="Total events" value={events.length} />
          <Stat label="Upcoming" value={upcoming.length} tone="bg-fr-softblue" />
          <Stat label="Completed" value={completed.length} tone="bg-fr-softgreen" />
          <Stat label="Registrations" value={totalRegs} tone="bg-fr-yellow" />
          <Stat label="Seats left (upcoming)" value={remaining} suffix={unlimited ? "+" : ""} />
          <Stat label="Payments to verify" value={pendingPayments ?? 0} tone={(pendingPayments ?? 0) > 0 ? "bg-fr-orange" : "bg-white"} />
        </section>

        <section className="card-pop mt-6 bg-white p-5">
          <h2 className="font-display text-xl font-bold">Most popular events</h2>
          {popular.length === 0 ? (
            <p className="mt-2 text-[14px] text-fr-muted">No registrations yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {popular.map((e, i) => (
                <li key={e.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 text-[14px]">
                  <span className="font-display text-lg font-bold">{i + 1}</span>
                  <div className="min-w-0">
                    <Link href={`/admin/events/${e.id}`} className="block truncate font-bold hover:underline">
                      {e.title}
                    </Link>
                    <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-ink bg-fr-warm">
                      <div className="h-full bg-fr-yellow" style={{ width: `${Math.max(4, (e.registeredCount / maxRegs) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="font-bold tabular-nums">
                    {e.registeredCount}
                    {e.capacity ? <span className="text-fr-muted"> / {e.capacity}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* List */}
        <nav className="mt-10 flex flex-wrap gap-2">
          {TABS.map(([k, label]) => (
            <Link
              key={k}
              href={k === "all" ? "/admin/events" : `/admin/events?tab=${k}`}
              className={clsx("rounded-full border-2 border-ink px-4 py-1.5 text-[14px] font-bold", tab === k ? "bg-ink text-white" : "bg-white hover:bg-fr-cream")}
            >
              {label}
            </Link>
          ))}
        </nav>

        {shown.length === 0 ? (
          <div className="card-pop mt-6 bg-white p-8 text-center">
            <p className="font-bold">No events here yet.</p>
            <Link href="/admin/events/new" className="btn-yellow mt-4">
              Create the first one
            </Link>
          </div>
        ) : (
          <div className="card-pop mt-6 overflow-x-auto bg-white">
            <table className="w-full min-w-[760px] text-left text-[14px]">
              <thead className="border-b-2 border-ink bg-fr-cream text-[12px] font-bold uppercase tracking-[0.1em]">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">When (IST)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registrations</th>
                  <th className="px-4 py-3">Fee</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => {
                  const pct = e.capacity ? Math.min(100, Math.round((e.registeredCount / e.capacity) * 100)) : null;
                  return (
                    <tr key={e.id} className="border-b border-ink/15 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/admin/events/${e.id}`} className="font-bold hover:underline">
                          {e.title}
                        </Link>
                        <div className="mt-1 flex items-center gap-2">
                          <CategoryChip category={e.category} className="!text-[10px]" />
                          {e.isFeatured && <span className="text-[12px] font-bold text-fr-blue">Featured</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDateTime(e.startsAt, e.timezone)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge e={e} now={now} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold tabular-nums">{e.registeredCount}</span>
                        <span className="text-fr-muted"> / {e.capacity ?? "∞"}</span>
                        {pct != null && (
                          <div className="mt-1 h-2 w-28 overflow-hidden rounded-full border border-ink bg-fr-warm">
                            <div className={clsx("h-full", pct >= 100 ? "bg-fr-red" : "bg-fr-green")} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold">{feeLabel(e.fee)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link href={`/admin/events/${e.id}`} className="rounded-full border-2 border-ink px-3 py-1 font-bold hover:bg-fr-cream">
                          Manage
                        </Link>{" "}
                        <Link href={`/admin/events/${e.id}/edit`} className="rounded-full border-2 border-ink px-3 py-1 font-bold hover:bg-fr-cream">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "bg-white", suffix = "" }: { label: string; value: number; tone?: string; suffix?: string }) {
  return (
    <div className={clsx("card-pop px-4 py-3", tone)}>
      <p className="h-display text-3xl tabular-nums">
        {value.toLocaleString("en-IN")}
        {suffix}
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]">{label}</p>
    </div>
  );
}
