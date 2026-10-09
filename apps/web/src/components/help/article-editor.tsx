"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Eye, Info, PencilSimple, Sparkle } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { AiTag } from "@/components/ai/ai-tag";
import { useT } from "@/i18n/client";
import { ArticleBody } from "./article-body";
import { AI_DRAFTS, CATEGORIES, HELP_SITE, type Article, type ArticleVersion, type HelpLang } from "./sample";

/**
 * Writing an article (decided 2026-10-07): one version per language. AI can draft a translation, but a person
 * must mark it reviewed before it can go live; unreviewed versions never reach the public site. Managers
 * publish; everyone else saves drafts and sends them for review.
 */
export function ArticleEditor({ base, article, initialTitle, canPublish }: { base: string; article: Article | null; initialTitle?: string; canPublish: boolean }) {
  const t = useT("helpCenter");
  const tAll = useT();
  const [lang, setLang] = useState<HelpLang>("en");
  const [versions, setVersions] = useState<Partial<Record<HelpLang, ArticleVersion>>>(article?.versions ?? { en: { title: initialTitle ?? "", body: "" } });
  const [category, setCategory] = useState(article?.category ?? CATEGORIES[0].id);
  const [status, setStatus] = useState<Article["status"]>(article?.status ?? "draft");
  const [preview, setPreview] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const v = versions[lang];
  const aiDraft = article && AI_DRAFTS[article.id]?.[lang];
  const unreviewed = HELP_SITE.languages.filter((l) => versions[l]?.aiDraft);
  const enReady = !!versions.en?.title.trim() && !!versions.en?.body.trim();
  const set = (patch: Partial<ArticleVersion>) => setVersions({ ...versions, [lang]: { title: "", body: "", ...v, ...patch } });
  const input = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base";

  return (
    <div className="grid gap-5">
      <Link href={`${base}/help`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("title")}</Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h1 className="title text-2xl">{versions.en?.title || t("untitled")}</h1>
          <p className="text-sm text-muted">{t(`statuses.${status}`)}{article ? ` · ${article.author}` : ""}</p>
        </div>
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setNote(t("draftSaved"))} className={buttonClass("secondary", "sm")}>{t("saveDraft")}</button>
          {canPublish ? (
            <button
              type="button"
              disabled={!enReady}
              onClick={() => { setStatus("published"); setNote(unreviewed.length ? t("publishedExcept", { langs: unreviewed.map((l) => l.toUpperCase()).join(", ") }) : t("published")); }}
              className={buttonClass("primary", "sm")}
            >
              {status === "published" ? t("update") : t("publish")}
            </button>
          ) : (
            <button type="button" disabled={!enReady} onClick={() => setNote(t("sentForReview"))} className={buttonClass("primary", "sm")}>{t("sendForReview")}</button>
          )}
        </span>
      </header>

      {note && <p role="status" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-done-soft px-4 py-2 text-sm"><Info size={16} aria-hidden="true" />{note} {t("previewNote")}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {HELP_SITE.languages.length > 1 ? <div role="tablist" aria-label={t("language")} className="inline-flex rounded-full bg-surface-2 p-0.5">
          {HELP_SITE.languages.map((l) => (
            <button key={l} role="tab" type="button" aria-selected={lang === l} onClick={() => { setLang(l); setPreview(false); }} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium ${lang === l ? "bg-surface shadow-[var(--shadow-1)]" : "text-muted"}`}>
              {l.toUpperCase()}
              {versions[l]?.aiDraft && <Sparkle size={12} weight="fill" className="text-ai" aria-label={t("langState.aiDraft")} />}
            </button>
          ))}
        </div> : <span />}
        <span className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t("category")}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="min-h-9 rounded-full border border-input bg-surface px-3 text-sm">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setPreview(!preview)} aria-pressed={preview} className={buttonClass("ghost", "sm")}>
            {preview ? <PencilSimple size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />} {preview ? t("edit") : t("preview")}
          </button>
        </span>
      </div>

      {v?.aiDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-ai/30 bg-ai-soft p-4 text-sm">
          <p className="flex flex-wrap items-center gap-2"><AiTag label={t("aiDraftTag")} /> {t("aiDraftBody")}</p>
          <button type="button" onClick={() => set({ aiDraft: false })} className={buttonClass("secondary", "sm")}>{t("markReviewed")}</button>
        </div>
      )}

      {!v && lang !== "en" ? (
        <div className="grid justify-items-start gap-3 rounded-[var(--radius-panel)] border border-dashed border-border p-6">
          <p className="text-muted">{t("noVersion")}</p>
          <span className="flex flex-wrap gap-2">
            <button type="button" disabled={!aiDraft} title={aiDraft ? undefined : t("aiDraftUnavailable")} onClick={() => aiDraft && setVersions({ ...versions, [lang]: aiDraft })} className={buttonClass("secondary", "sm")}>
              <Sparkle size={16} weight="fill" className="text-ai" aria-hidden="true" /> {t("draftWithAi")} <span className="text-xs text-muted">{tAll("ai.credits", { count: 2 })}</span>
            </button>
            <button type="button" onClick={() => set({})} className={buttonClass("ghost", "sm")}>{t("writeMyself")}</button>
          </span>
          {!aiDraft && <p className="text-xs text-muted">{t("aiDraftUnavailable")}</p>}
        </div>
      ) : preview ? (
        <article className="grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-6" lang={lang}>
          <h2 className="title text-2xl">{v?.title}</h2>
          <ArticleBody body={v?.body ?? ""} className="max-w-[68ch]" />
        </article>
      ) : (
        <div className="grid gap-3" lang={lang}>
          <label className="grid gap-1 text-sm font-medium">{t("articleTitle")}<input value={v?.title ?? ""} onChange={(e) => set({ title: e.target.value })} maxLength={120} className={input} /></label>
          <label className="grid gap-1 text-sm font-medium">
            {t("body")}
            <textarea value={v?.body ?? ""} onChange={(e) => set({ body: e.target.value })} rows={14} className="w-full resize-y rounded-[var(--radius-control)] border border-input bg-surface p-3 font-mono text-sm leading-relaxed" />
            <span className="font-normal text-muted">{t("markupHelp")}</span>
          </label>
        </div>
      )}
      {!enReady && <p className="text-sm text-muted">{t("needEnglish")}</p>}
    </div>
  );
}
