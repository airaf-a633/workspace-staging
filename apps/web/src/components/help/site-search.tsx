"use client";

import Link from "next/link";
import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { ARTICLES, type HelpLang, liveVersion } from "./sample";
import { siteText } from "./site-text";

/** Search on the public help site: title and body, published articles in the chosen language only. */
export function SiteSearch({ base, lang }: { base: string; lang: HelpLang }) {
  const s = siteText(lang);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const hits = query.length < 2 ? [] : ARTICLES.filter((a) => liveVersion(a, lang) && `${liveVersion(a, lang)!.title} ${liveVersion(a, lang)!.body}`.toLowerCase().includes(query)).slice(0, 6);
  const suffix = lang === "en" ? "" : `?lang=${lang}`;
  return (
    <div className="relative grid gap-2">
      <label className="relative">
        <span className="sr-only">{s("searchLabel")}</span>
        <MagnifyingGlass size={20} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={s("search")} className="min-h-14 w-full rounded-[var(--radius-panel)] border border-input bg-surface ps-12 pe-4 text-base shadow-[var(--shadow-1)]" dir="auto" />
      </label>
      {query.length >= 2 && (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-2 shadow-[var(--shadow-2)]" role="region" aria-live="polite">
          {hits.length === 0 ? (
            <p className="p-3 text-sm text-muted">{s("noResults", { q: q.trim() })}</p>
          ) : (
            <ul>
              {hits.map((a) => (
                <li key={a.id}>
                  <Link href={`${base}/a/${a.slug}${suffix}`} className="block rounded-[var(--radius-control)] px-3 py-2.5 hover:bg-surface-2">
                    <span className="font-medium">{liveVersion(a, lang)!.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
