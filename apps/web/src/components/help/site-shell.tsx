import Link from "next/link";
import type { ReactNode } from "react";
import { HELP_SITE, type HelpLang } from "./sample";
import { siteText } from "./site-text";

/**
 * The public help site's frame (decided 2026-10-07): the business's name and colour, a language switch, and
 * nothing of Relay's app chrome. It always renders light.
 */
export function SiteShell({ base, lang, children }: { base: string; lang: HelpLang; children: ReactNode }) {
  const s = siteText(lang);
  const q = (l: HelpLang) => (l === "en" ? "" : `?lang=${l}`);
  return (
    <div lang={lang} className="force-light flex min-h-dvh flex-col bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
          <Link href={`${base}${q(lang)}`} className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-[var(--radius-control)] text-sm text-white" style={{ background: HELP_SITE.color }} aria-hidden="true">N</span>
            {HELP_SITE.name}
          </Link>
          {HELP_SITE.languages.length > 1 && <nav aria-label={s("language")} className="flex gap-1 text-sm">
            {HELP_SITE.languages.map((l) => (
              <Link key={l} href={`?lang=${l}`} aria-current={l === lang ? "true" : undefined} className={`rounded-full px-3 py-1 ${l === lang ? "bg-surface-2 font-medium" : "text-muted hover:text-text"}`}>
                {l.toUpperCase()}
              </Link>
            ))}
          </nav>}
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted">{s("poweredBy")}</footer>
    </div>
  );
}
