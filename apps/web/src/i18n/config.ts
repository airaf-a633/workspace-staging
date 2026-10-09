/**
 * App languages. Relay ships in English only (decided 2026-10-07: a global product, not Arabic-centric).
 * The translation system stays so a language can be added later: add its code here and a messages file.
 */
export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Holds the person's language on this device. Members also keep it on their row (members.locale). */
export const LOCALE_COOKIE = "lang";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
/** Right-to-left interface languages; none today. Customer text in any script still uses dir="auto". */
const RTL: readonly string[] = [];
export const dirOf = (l: Locale) => (RTL.includes(l) ? "rtl" : "ltr");

/** The Intl locale for formatting. */
export const intlLocale = (l: Locale): string => ({ en: "en-GB" })[l];
