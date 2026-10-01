/** App languages. Arabic is right to left; numbers stay Western digits in both (decided 2026-10-01). */
export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Holds the person's language on this device. Members also keep it on their row (members.locale). */
export const LOCALE_COOKIE = "lang";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
export const dirOf = (l: Locale) => (l === "ar" ? "rtl" : "ltr");

/** The Intl locale for formatting: Arabic words, Western digits. */
export const intlLocale = (l: Locale) => (l === "ar" ? "ar-AE-u-nu-latn" : "en-GB");

/**
 * The Arabic text is a placeholder draft for checking layouts (decided 2026-10-01: layout only for now).
 * A person reviews it before any customer sees it. While this is true, the app shows a "Draft Arabic" tag.
 */
export const ARABIC_IS_DRAFT = true;
