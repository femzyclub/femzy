import Link from "next/link";
import clsx from "clsx";
import { Logo } from "@/components/brand/Logo";

const TABS = [
  { key: "events", href: "/admin/events", label: "Events" },
] as const;

/** Shared header for the admin dashboard. Add a tab here when a new admin module is added. */
export function AdminHeader({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <header className="border-b-2 border-ink bg-fr-warm">
      <div className="container-x flex h-[72px] items-center justify-between gap-4">
        <Logo size={52} />
        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Admin sections">
          <span className="hidden text-[13px] font-bold text-fr-muted sm:inline">Admin ·</span>
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active === t.key ? "page" : undefined}
              className={clsx(
                "rounded-full border-2 border-ink px-3 py-1 text-[13px] font-bold",
                active === t.key ? "bg-fr-yellow" : "bg-white hover:bg-fr-cream",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
