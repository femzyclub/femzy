// Timezone-safe date helpers. Events are stored in UTC and always shown in the event's
// own timezone (Asia/Kolkata by default), so a visitor abroad still sees the real local time.

export const DEFAULT_TZ = "Asia/Kolkata";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsIn(date: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p: Record<string, number> = {};
  for (const { type, value } of f.formatToParts(date)) if (type !== "literal") p[type] = Number(value);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour === 24 ? 0 : p.hour, minute: p.minute, second: p.second };
}

/** Milliseconds the timezone is ahead of UTC at that instant (IST = +19 800 000). */
function offsetMs(date: Date, tz: string) {
  const p = partsIn(date, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-11-20T18:30" typed in the event's timezone → UTC Date. */
export function wallTimeToUtc(local: string, tz = DEFAULT_TZ): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = guess - offsetMs(new Date(guess), tz);
  utc = guess - offsetMs(new Date(utc), tz); // second pass handles DST edges
  return new Date(utc);
}

/** UTC ISO → "YYYY-MM-DDTHH:mm" in tz (for <input type="datetime-local">). */
export function utcToWallTime(iso: string | null | undefined, tz = DEFAULT_TZ) {
  if (!iso) return "";
  const p = partsIn(new Date(iso), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** UTC ISO → calendar date key "YYYY-MM-DD" in tz. */
export function dateKey(iso: string | Date, tz = DEFAULT_TZ) {
  const p = partsIn(typeof iso === "string" ? new Date(iso) : iso, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Today's "YYYY-MM-DD" and month in tz. */
export function todayKey(tz = DEFAULT_TZ) {
  return dateKey(new Date(), tz);
}

/** Every date key an event touches (multi-day events appear on each day, capped at 62 days). */
export function eventDateKeys(startsAt: string, endsAt: string, tz = DEFAULT_TZ) {
  const keys: string[] = [];
  const first = dateKey(startsAt, tz);
  const last = dateKey(endsAt, tz);
  const [y, m, d] = first.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 62; i++) {
    const k = cursor.toISOString().slice(0, 10);
    keys.push(k);
    if (k >= last) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/** UTC bounds of a calendar month in tz (inclusive start, exclusive end). */
export function monthRangeUtc(year: number, month: number, tz = DEFAULT_TZ) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = wallTimeToUtc(`${year}-${pad(month)}-01T00:00`, tz)!;
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  const to = wallTimeToUtc(`${ny}-${pad(nm)}-01T00:00`, tz)!;
  return { from, to };
}

const fmt = (iso: string, tz: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: tz, ...opts }).format(new Date(iso));

export const formatDay = (iso: string, tz = DEFAULT_TZ) => fmt(iso, tz, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
export const formatDayShort = (iso: string, tz = DEFAULT_TZ) => fmt(iso, tz, { day: "numeric", month: "short" });
export const formatTime = (iso: string, tz = DEFAULT_TZ) => fmt(iso, tz, { hour: "numeric", minute: "2-digit" });
export const formatDateTime = (iso: string, tz = DEFAULT_TZ) =>
  fmt(iso, tz, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** "Sat, 21 Nov 2026 · 7:00 am – 10:00 am" or a multi-day range. */
export function formatRange(startsAt: string, endsAt: string, tz = DEFAULT_TZ) {
  if (dateKey(startsAt, tz) === dateKey(endsAt, tz)) {
    return `${formatDay(startsAt, tz)} · ${formatTime(startsAt, tz)} – ${formatTime(endsAt, tz)}`;
  }
  return `${formatDateTime(startsAt, tz)} – ${formatDateTime(endsAt, tz)}`;
}

/** Short tz label shown next to times, e.g. "IST". */
export function tzLabel(tz = DEFAULT_TZ) {
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "IST";
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? tz;
}
