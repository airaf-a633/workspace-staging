"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowSquareOut, Info, MagnifyingGlass, Plus, Sparkle } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { useFormat, useT } from "@/i18n/client";
import { ADDABLE_LANGUAGES, ARTICLES, CATEGORIES, GAPS, HELP_SITE, type Article, type HelpLang } from "./sample";

/**
 * Help Center for the team (decided 2026-10-07): articles with their status and languages, the gaps customers
 * and the team reveal, and the public site's settings. Anyone with canned.use drafts; managers publish.
 */
type Tab = "articles" | "gaps" | "site";

function LangChip({ a, lang }: { a: Article; lang: HelpLang }) {
  const t = useT("helpCenter");
  const v = a.versions[lang];
  const state = !v ? "missing" : v.aiDraft ? "aiDraft" : "ok";
  return (
    <span title={t(`langState.${state}`)} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${state === "ok" ? "bg-surface-2" : state === "aiDraft" ? "bg-ai-soft text-ai" : "border border-dashed border-border text-muted"}`}>
      {state === "aiDraft" && <Sparkle size={11} weight="fill" aria-hidden="true" />}
      {lang.toUpperCase()}
    </span>
  );
}

export function HelpAdmin({ base, canPublish }: { base: string; canPublish: boolean }) {
  const t = useT("helpCenter");
  const fmt = useFormat();
  const [tab, setTab] = useState<Tab>("articles");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [site, setSite] = useState({ name: HELP_SITE.name, domain: HELP_SITE.domain, color: HELP_SITE.color, extra: [] as string[] });
  const multilingual = HELP_SITE.languages.length > 1;
  const [saved, setSaved] = useState(false);
  const list = ARTICLES.filter(
    (a) => (status === "all" || a.status === status) && (cat === "all" || a.category === cat) && (!q.trim() || (a.versions.en?.title ?? "").toLowerCase().includes(q.trim().toLowerCase())),
  );
  const field = "min-h-9 rounded-full border border-input bg-surface px-3 text-sm";
  const input = "min-h-10 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm";

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="title text-3xl">{t("title")}</h1>
        <span className="flex gap-2">
          <a href="/help/northwind" target="_blank" rel="noreferrer" className={buttonClass("ghost", "sm")}><ArrowSquareOut size={16} aria-hidden="true" /> {t("viewSite")}</a>
          <Link href={`${base}/help/new`} className={buttonClass("primary", "sm")}><Plus size={16} aria-hidden="true" /> {t("newArticle")}</Link>
        </span>
      </header>

      <div role="tablist" aria-label={t("title")} className="flex gap-5 border-b border-border">
        {(["articles", "gaps", "site"] as const).map((k) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px min-h-10 border-b-2 text-sm font-medium ${tab === k ? "border-primary text-text" : "border-transparent text-muted hover:text-text"}`}>
            {t(`tabs.${k}`)}
            {k === "gaps" && <span className="ms-1.5 rounded-full bg-surface-2 px-1.5 text-xs text-muted">{GAPS.noResults.length + GAPS.repeated.length}</span>}
          </button>
        ))}
      </div>

      {tab === "articles" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative w-full sm:w-64">
              <span className="sr-only">{t("search")}</span>
              <MagnifyingGlass size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="min-h-9 w-full rounded-full border border-input bg-surface ps-9 pe-3 text-sm" />
            </label>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={field} aria-label={t("status")}>
              {(["all", "published", "draft"] as const).map((s) => <option key={s} value={s}>{t(`statusFilter.${s}`)}</option>)}
            </select>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className={field} aria-label={t("category")}>
              <option value="all">{t("allCategories")}</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-1 ring-border">
            <table className="w-full min-w-[44rem] text-sm">
              <thead><tr className="border-b border-border text-muted">{(["title", "status", ...(multilingual ? (["languages"] as const) : []), "views", "helpful", "updated"] as const).map((k) => <th key={k} scope="col" className={`px-4 py-3 font-medium ${k === "title" ? "text-start" : k === "views" || k === "helpful" ? "text-end" : "text-start"}`}>{t(`cols.${k}`)}</th>)}</tr></thead>
              <tbody>
                {list.map((a) => {
                  const votes = a.helpful.yes + a.helpful.no;
                  return (
                    <tr key={a.id} className="relative border-b border-border last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-3">
                        <Link href={`${base}/help/${a.id}`} className="font-medium after:absolute after:inset-0">{a.versions.en?.title}</Link>
                        <span className="block text-xs text-muted">{CATEGORIES.find((c) => c.id === a.category)?.name} · {a.author}</span>
                      </td>
                      <td className="px-4"><Badge tone={a.status === "published" ? "done" : "new"}>{t(`statuses.${a.status}`)}</Badge></td>
                      {multilingual && <td className="px-4"><span className="flex gap-1">{HELP_SITE.languages.map((l) => <LangChip key={l} a={a} lang={l} />)}</span></td>}
                      <td className="px-4 text-end tabular-nums">{fmt.number(a.views)}</td>
                      <td className="px-4 text-end tabular-nums">{votes ? `${Math.round((a.helpful.yes / votes) * 100)}%` : "—"}</td>
                      <td className="px-4 text-muted">{a.updatedDaysAgo === 0 ? t("today") : t("daysAgo", { count: a.updatedDaysAgo })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!canPublish && <p className="flex items-center gap-2 text-sm text-muted"><Info size={16} aria-hidden="true" />{t("draftOnly")}</p>}
        </>
      )}

      {tab === "gaps" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="grid content-start gap-3 rounded-[var(--radius-panel)] border border-border bg-surface p-5">
            <div className="grid gap-1"><h2 className="font-semibold">{t("noResults")}</h2><p className="text-sm text-muted">{t("noResultsHelp")}</p></div>
            <ul className="grid gap-2">
              {GAPS.noResults.map((g) => (
                <li key={g.query} className="flex items-center justify-between gap-3 text-sm">
                  <span>&ldquo;{g.query}&rdquo; <span className="text-muted">· {t("searches", { count: g.count })}</span></span>
                  <Link href={`${base}/help/new?title=${encodeURIComponent(g.query)}`} className={buttonClass("ghost", "sm")}>{t("write")}</Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="grid content-start gap-3 rounded-[var(--radius-panel)] border border-border bg-surface p-5">
            <div className="grid gap-1"><h2 className="font-semibold">{t("repeated")}</h2><p className="text-sm text-muted">{t("repeatedHelp")}</p></div>
            <ul className="grid gap-2">
              {GAPS.repeated.map((g) => (
                <li key={g.question} className="flex items-center justify-between gap-3 text-sm">
                  <span className="grid"><span>{g.question}</span><span className="text-xs text-muted">{t("answeredBy", { count: g.count, names: g.from })}</span></span>
                  <Link href={`${base}/help/new?title=${encodeURIComponent(g.question)}`} className={buttonClass("ghost", "sm")}>{t("write")}</Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === "site" && (
        <form onSubmit={(e) => { e.preventDefault(); setSaved(true); }} className="grid max-w-xl gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-5">
          <fieldset disabled={!canPublish} className="grid gap-4">
            <label className="grid gap-1 text-sm font-medium">{t("site.name")}<input value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} className={input} /></label>
            <label className="grid gap-1 text-sm font-medium">{t("site.domain")}<input value={site.domain} onChange={(e) => setSite({ ...site, domain: e.target.value })} className={input} dir="ltr" /><span className="font-normal text-muted">{t("site.domainHelp")}</span></label>
            <label className="flex items-center gap-3 text-sm font-medium">{t("site.colour")}<input type="color" value={site.color} onChange={(e) => setSite({ ...site, color: e.target.value.toUpperCase() })} className="size-9 cursor-pointer rounded-full border border-border bg-transparent" /><span className="font-normal text-muted" dir="ltr">{site.color}</span></label>
            <div className="grid gap-2 text-sm">
              <span className="font-medium">{t("site.languages")}</span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-2 px-3 py-1">English</span>
                {site.extra.map((l) => <span key={l} className="rounded-full bg-surface-2 px-3 py-1">{l}</span>)}
                <select value="" onChange={(e) => e.target.value && setSite({ ...site, extra: [...site.extra, e.target.value] })} className="min-h-8 rounded-full border border-dashed border-input bg-transparent px-3 text-sm text-muted" aria-label={t("site.addLanguage")}>
                  <option value="">{t("site.addLanguage")}</option>
                  {ADDABLE_LANGUAGES.filter((l) => !site.extra.includes(l)).map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </span>
              <span className="text-muted">{t("site.languagesHelp")}</span>
            </div>
          </fieldset>
          {canPublish && <span className="flex items-center justify-end gap-3">{saved && <span role="status" className="text-sm text-muted">{t("saved")}</span>}<button type="submit" className={buttonClass("primary", "sm")}>{t("save")}</button></span>}
        </form>
      )}
    </div>
  );
}
