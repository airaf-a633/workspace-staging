"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { createTranslator, scoped, type ScopedT, type Translator } from "./translate";
import { makeFormat } from "./format";
import type { Messages } from "./messages/en";

const I18n = createContext<{ locale: Locale; messages: Messages } | null>(null);

/** Set once in the root layout with the request's language and its messages. */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

function useI18n() {
  const v = useContext(I18n);
  if (!v) throw new Error("I18nProvider is missing above this component");
  return v;
}

export function useLocale() {
  return useI18n().locale;
}

function useTranslator() {
  const { locale, messages } = useI18n();
  return useMemo(() => createTranslator(messages, locale), [locale, messages]);
}

/** Client Components: `const t = useT("inbox")`. */
export function useT(): Translator;
export function useT<P extends keyof Messages>(ns: P): ScopedT<Messages[P]>;
export function useT(ns?: string): unknown {
  const t = useTranslator();
  return useMemo(() => (ns ? scoped(t, ns) : t), [t, ns]);
}

export function useFormat() {
  const { locale } = useI18n();
  const t = useTranslator();
  return useMemo(() => makeFormat(locale, t), [locale, t]);
}
