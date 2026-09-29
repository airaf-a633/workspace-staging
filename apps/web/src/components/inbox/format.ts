import { fils as toFils, formatAed } from "@app/domain";

/** 24-hour Dubai time, as decided: "14:05", "Yesterday", "Mon 28 Sep". Built from parts so server and browser agree. */
const TZ = "Asia/Dubai";
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayParts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });

function parts(at: number) {
  const p = Object.fromEntries(dayParts.formatToParts(at).map((x) => [x.type, x.value]));
  return { key: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday, day: p.day, month: p.month, year: p.year };
}

function dayDiff(at: number, now: number) {
  const a = parts(at), n = parts(now);
  if (a.key === n.key) return 0;
  if (a.key === parts(now - 86_400_000).key) return 1;
  return 2;
}

export function time(at: number) {
  return clock.format(at);
}

function date(at: number, now: number) {
  const p = parts(at);
  return `${p.weekday} ${p.day} ${p.month}${p.year !== parts(now).year ? ` ${p.year}` : ""}`;
}

/** For conversation rows. */
export function listTime(at: number, now: number) {
  const d = dayDiff(at, now);
  return d === 0 ? time(at) : d === 1 ? "Yesterday" : date(at, now);
}

/** For the meta line under a message. */
export function messageTime(at: number, now: number) {
  const d = dayDiff(at, now);
  return d === 0 ? time(at) : d === 1 ? `Yesterday ${time(at)}` : `${date(at, now)}, ${time(at)}`;
}

export function waitedFor(at: number, now: number) {
  const m = Math.max(1, Math.round((now - at) / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function fileSize(bytes: number) {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function aed(amount: number) {
  return `AED ${formatAed(toFils(amount))}`;
}
