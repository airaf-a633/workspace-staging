"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ARABIC_IS_DRAFT, LOCALES, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";
import { useLocale, useT } from "@/i18n/client";

/**
 * EN / عربي. Each option is written in its own language so anyone can find theirs.
 * `saveToProfile` also stores the choice on the signed-in member (Settings › Account).
 */
export function LanguageSwitch({ tone = "plain", saveToProfile = false, className = "" }: { tone?: "plain" | "glass"; saveToProfile?: boolean; className?: string }) {
  const current = useLocale();
  const t = useT("language");
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(l: Locale) {
    if (l === current) return;
    start(async () => {
      await setLocale(l, { saveToProfile });
      router.refresh();
    });
  }

  const wrap = tone === "glass" ? "glass" : "bg-surface-2";
  const on = tone === "glass" ? "bg-white text-[#0F2537]" : "bg-surface text-text shadow-[var(--shadow-1)]";
  const off = tone === "glass" ? "text-white/85 hover:text-white" : "text-muted hover:text-text";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span role="group" aria-label={t("label")} aria-busy={pending} className={`inline-flex rounded-full p-0.5 text-sm ${wrap} ${pending ? "opacity-70" : ""}`}>
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={current === l}
            onClick={() => choose(l)}
            className={`min-h-8 rounded-full px-3 font-medium transition-colors ${current === l ? on : off}`}
          >
            {l === "en" ? "EN" : t("ar")}
          </button>
        ))}
      </span>
      {current === "ar" && ARABIC_IS_DRAFT && (
        <span title={t("draftNote")} className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone === "glass" ? "bg-white/20 text-white" : "bg-warn-soft text-text"}`}>
          {t("draftTag")}
        </span>
      )}
    </span>
  );
}
