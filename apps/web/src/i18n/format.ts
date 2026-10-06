import { fils as toFils, formatAed } from "@app/domain";
import { intlLocale, type Locale } from "./config";
import type { Translator } from "./translate";
import { DEFAULT_TZ } from "./zone";

/**
 * Dates, times, money and sizes in the person's language and time zone. 24-hour clock ("14:05", "Yesterday",
 * "Mon 28 Sep"), Western digits in Arabic too, money as "$1,250.00". Built from parts so the server
 * and the browser print the same thing.
 */
/** Relay went global on 2026-10-07; amounts show in US dollars until workspaces pick their own currency. */
const CURRENCY: "usd" | "aed" = "usd";

export function makeFormat(locale: Locale, t: Translator, tz: string = DEFAULT_TZ) {
  const loc = intlLocale(locale);
  const clock = new Intl.DateTimeFormat(loc, { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dayParts = new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const longDay = new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: "long" });
  const shortDate = new Intl.DateTimeFormat(loc, { timeZone: tz, day: "numeric", month: "short" });
  const longDate = new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: "long", day: "numeric", month: "long" });
  const nf = new Intl.NumberFormat(loc);
  const list = new Intl.ListFormat(loc, { style: "long", type: "conjunction" });

  function parts(at: number) {
    const p = Object.fromEntries(dayParts.formatToParts(at).map((x) => [x.type, x.value]));
    // Some ICU versions print "Sept"; the decided English style is three letters ("Mon 28 Sep").
    const month = locale === "en" ? p.month.slice(0, 3) : p.month;
    return { key: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday, day: p.day, month, year: p.year };
  }
  function dayDiff(at: number, now: number) {
    const a = parts(at), n = parts(now);
    if (a.key === n.key) return 0;
    if (a.key === parts(now - 86_400_000).key) return 1;
    return 2;
  }
  const time = (at: number) => clock.format(at);
  function date(at: number, now: number) {
    const p = parts(at);
    return `${p.weekday} ${p.day} ${p.month}${p.year !== parts(now).year ? ` ${p.year}` : ""}`;
  }

  return {
    locale,
    /** The IANA zone these times are shown in. */
    tz,
    time,
    date,
    /** "12 Oct" */
    shortDate: (at: number) => shortDate.format(at),
    /** "Thursday 1 October", for page headers. */
    longDate: (at: number) => longDate.format(at),
    /** "Thursday" */
    weekday: (at: number) => longDay.format(at),
    number: (n: number) => nf.format(n),
    /** "Sara, Omar and Priya" */
    list: (items: string[]) => list.format(items),
    /** For conversation rows. */
    listTime(at: number, now: number) {
      const d = dayDiff(at, now);
      return d === 0 ? time(at) : d === 1 ? t("time.yesterday") : date(at, now);
    },
    /** For the meta line under a message. */
    messageTime(at: number, now: number) {
      const d = dayDiff(at, now);
      return d === 0 ? time(at) : d === 1 ? t("time.yesterdayAt", { time: time(at) }) : t("time.dateAt", { date: date(at, now), time: time(at) });
    },
    /** Day separators in a thread: "Today", "Yesterday", "Mon 28 Sep". */
    dayLabel(at: number, now: number) {
      const d = dayDiff(at, now);
      return d === 0 ? t("time.today") : d === 1 ? t("time.yesterday") : date(at, now);
    },
    sameDay: (a: number, b: number) => parts(a).key === parts(b).key,
    /** For lists of customers: "4 min ago", "2 h ago", "Yesterday", "9 days ago", then a date. */
    ago(at: number, now: number) {
      const min = Math.max(1, Math.round((now - at) / 60_000));
      if (min < 60) return t("time.minAgo", { count: min });
      if (min < 24 * 60 && dayDiff(at, now) === 0) return t("time.hoursAgo", { count: Math.round(min / 60) });
      if (dayDiff(at, now) === 1) return t("time.yesterday");
      const days = Math.round((now - at) / 86_400_000);
      return days < 30 ? t("time.daysAgo", { count: Math.max(2, days) }) : date(at, now);
    },
    /** "17 min", "1 h 5 min" from a number of minutes already counted. */
    minutesWaited(min: number) {
      const m = Math.max(1, Math.round(min));
      return m < 60 ? t("time.minutes", { count: m }) : t("time.hoursMinutes", { h: Math.floor(m / 60), m: m % 60 });
    },
    waitedFor(at: number, now: number) {
      const m = Math.max(1, Math.round((now - at) / 60_000));
      return m < 60 ? t("time.minutes", { count: m }) : t("time.hoursMinutes", { h: Math.floor(m / 60), m: m % 60 });
    },
    fileSize(bytes: number) {
      return bytes >= 1_048_576 ? t("time.mb", { n: (bytes / 1_048_576).toFixed(1) }) : t("time.kb", { n: String(Math.max(1, Math.round(bytes / 1024))) });
    },
    /** "$1,250.00", from minor units (cents). One workspace currency for now; per-workspace currency comes with billing. */
    money: (amount: number) => t(`money.${CURRENCY}`, { amount: formatAed(toFils(amount), loc) }),
    /** "$1,250" for whole amounts on cards. */
    moneyWhole: (amount: number) => t(`money.${CURRENCY}`, { amount: nf.format(Math.round(amount)) }),
  };
}

export type Format = ReturnType<typeof makeFormat>;
