import clsx from "clsx";
import type { EventItem } from "@/lib/events/types";

/** Draft / Published / Completed / Cancelled pill for the admin tables. */
export function StatusBadge({ e, now }: { e: Pick<EventItem, "status" | "endsAt">; now: number }) {
  const past = new Date(e.endsAt).getTime() < now;
  const [label, cls] =
    e.status === "draft"
      ? ["Draft", "bg-white"]
      : e.status === "cancelled"
        ? ["Cancelled", "bg-fr-red text-white"]
        : past
          ? ["Completed", "bg-fr-softgreen"]
          : ["Published", "bg-fr-yellow"];
  return <span className={clsx("inline-block rounded-full border-2 border-ink px-2.5 py-0.5 text-[12px] font-bold", cls)}>{label}</span>;
}
