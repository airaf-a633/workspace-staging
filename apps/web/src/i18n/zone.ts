/**
 * Time zones (decided 2026-10-07): every person sees times in their own zone, detected from the browser and
 * kept in a cookie (and later on their profile). Reports, business hours and SLAs use the workspace's zone.
 * These helpers do calendar maths in any IANA zone, daylight saving included, with no date library.
 */

export const TZ_COOKIE = "tz";
/** Set when the person chose a zone by hand, so the browser's guess no longer replaces it. */
export const TZ_MANUAL_COOKIE = "tz_manual";
export const DEFAULT_TZ = "UTC";

const DAY = 86_400_000;

export function isTimeZone(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", weekday: "short" });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The wall clock in `tz` at instant `at`. Weekday 0 is Monday. */
export function wallClock(at: number, tz: string) {
  const p = Object.fromEntries(formatter(tz).formatToParts(at).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, s: +p.second, weekday: WEEKDAYS.indexOf(p.weekday) };
}

/** How far `tz` is ahead of UTC at instant `at`, in milliseconds. */
function offset(at: number, tz: string) {
  const w = wallClock(at, tz);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - Math.floor(at / 1000) * 1000;
}

/** The instant when the wall clock in `tz` reads y-m-d h:min (month 1-12; days may overflow). */
export function zonedInstant(y: number, m: number, d: number, h: number, min: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - offset(guess, tz);
  return guess - offset(first, tz);
}

/** Local midnight of the day containing `at`. */
export function startOfDay(at: number, tz: string) {
  const w = wallClock(at, tz);
  return zonedInstant(w.y, w.m, w.d, 0, 0, tz);
}

/** `days` after the day containing `at`, at local `hhmm` (default 09:00). */
export function dayAt(at: number, days: number, tz: string, hhmm = "09:00") {
  const w = wallClock(at, tz);
  const [h, min] = hhmm.split(":").map(Number);
  return zonedInstant(w.y, w.m, w.d + days, h, min, tz);
}

/** Whole calendar days from the day of `b` to the day of `a` in `tz` (0 = same day). */
export function dayDiff(a: number, b: number, tz: string) {
  return Math.round((startOfDay(a, tz) - startOfDay(b, tz)) / DAY);
}

/** Monday 0 … Sunday 6. */
export const weekdayOf = (at: number, tz: string) => wallClock(at, tz).weekday;
