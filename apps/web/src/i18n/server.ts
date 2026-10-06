import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { DEFAULT_TZ, TZ_COOKIE, isTimeZone } from "./zone";
import { createTranslator, scoped, type ScopedT, type Translator } from "./translate";
import { makeFormat } from "./format";
import { en, type Messages } from "./messages/en";
import { ar } from "./messages/ar";

export const MESSAGES: Record<Locale, Messages> = { en, ar };

/** The language for this request: the person's cookie, else English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
});

/** The person's time zone for this request: set from their browser (or by hand in Settings › Account), else UTC. */
export const getTimeZone = cache(async (): Promise<string> => {
  const v = (await cookies()).get(TZ_COOKIE)?.value;
  return isTimeZone(v) ? v : DEFAULT_TZ;
});

const translator = cache(async () => {
  const locale = await getLocale();
  return createTranslator(MESSAGES[locale], locale, en);
});

/** Server Components and actions: `const t = await getT("inbox")`. */
export async function getT(): Promise<Translator>;
export async function getT<P extends keyof Messages>(ns: P): Promise<ScopedT<Messages[P]>>;
export async function getT(ns?: string): Promise<unknown> {
  const t = await translator();
  return ns ? scoped(t, ns) : t;
}

export async function getFormat() {
  const locale = await getLocale();
  return makeFormat(locale, await translator(), await getTimeZone());
}
