"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

/**
 * Light, dark or follow the device (decided 2026-10-07). The choice lives in a cookie so the server renders
 * the right theme on the first paint; "system" leaves it to prefers-color-scheme. The public site and the
 * help site stay light (they use .force-light).
 */

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function ThemeProvider({ initial, children }: { initial: Theme; children: ReactNode }) {
  const [theme, set] = useState(initial);
  function setTheme(t: Theme) {
    set(t);
    document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

const OPTIONS: { key: Theme; Icon: typeof Sun }[] = [
  { key: "system", Icon: Desktop },
  { key: "light", Icon: Sun },
  { key: "dark", Icon: Moon },
];

/** A three-way switch. `compact` shows icons only (labels stay for screen readers and as tooltips). */
export function ThemeSwitch({ compact = false, tone = "plain", className = "" }: { compact?: boolean; tone?: "plain" | "onDark"; className?: string }) {
  const ctx = useContext(Ctx);
  const t = useT("theme");
  if (!ctx) return null;
  const wrap = tone === "onDark" ? "border border-white/25" : "bg-surface-2";
  const on = tone === "onDark" ? "bg-white text-[#111518]" : "bg-surface text-text shadow-[var(--shadow-1)]";
  const off = tone === "onDark" ? "text-white/80 hover:text-white" : "text-muted hover:text-text";
  return (
    <span role="group" aria-label={t("label")} className={`inline-flex rounded-full p-0.5 text-sm ${wrap} ${className}`}>
      {OPTIONS.map(({ key, Icon }) => (
        <button
          key={key}
          type="button"
          aria-pressed={ctx.theme === key}
          title={t(key)}
          onClick={() => ctx.setTheme(key)}
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full ${compact ? "px-2" : "px-3"} transition-colors ${ctx.theme === key ? on : off}`}
        >
          <Icon size={16} aria-hidden="true" />
          <span className={compact ? "sr-only" : ""}>{t(key)}</span>
        </button>
      ))}
    </span>
  );
}
