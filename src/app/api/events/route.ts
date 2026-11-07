import { NextResponse, type NextRequest } from "next/server";
import { getPublicEventsInRange } from "@/lib/events/data";
import { monthRangeUtc } from "@/lib/events/time";

// Always read live from the database so the calendar reflects admin changes immediately.
export const dynamic = "force-dynamic";

/** GET /api/events?month=2026-11 → published + cancelled events overlapping that month (IST). */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[1] < 2000 || +m[1] > 2100) {
    return NextResponse.json({ error: "Use ?month=YYYY-MM" }, { status: 400 });
  }
  const { from, to } = monthRangeUtc(+m[1], +m[2]);
  try {
    const { events, isDemo } = await getPublicEventsInRange(from, to);
    return NextResponse.json({ events, isDemo }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.warn("[events] calendar fetch failed", e);
    return NextResponse.json({ error: "Couldn't load events" }, { status: 500 });
  }
}
