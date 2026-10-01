"use client";

import Link from "next/link";
import { useState } from "react";
import { CaretDown, EnvelopeSimple, MagnifyingGlass, Plus, WhatsappLogo, X } from "@phosphor-icons/react";
import { canSeeDealValue, type Viewer } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { useFormat, useT } from "@/i18n/client";
import { valueLabel } from "@/i18n/labels";
import type { Person, Team } from "@/components/inbox/types";
import { SEGMENTS } from "./sample";
import type { Customer } from "./types";
import { STAGE } from "@/components/deals/stages";

const digits = (s = "") => s.replace(/\D/g, "");

interface Props {
  customers: Customer[];
  people: Person[];
  teams: Team[];
  viewer: Viewer;
  now: number;
  base: string;
  canEdit: boolean;
}

/* Customers as a calm table on desktop and two-line rows on phones (decided 2026-09-30). */
export function CustomerList({ customers: initial, people, teams, viewer, now, base, canEdit }: Props) {
  const [customers, setCustomers] = useState(initial);
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]["key"]>("all");
  const [tags, setTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", email: "", company: "", tag: "" });
  const [tried, setTried] = useState(false);

  const t = useT("customers");
  const tAll = useT();
  const fmt = useFormat();
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? tAll("common.nobody");
  const allTags = [...new Set(customers.flatMap((c) => c.tags))].sort();
  const seg = SEGMENTS.find((s) => s.key === segment)!;
  const q = query.trim().toLowerCase();
  const list = customers.filter(
    (c) =>
      seg.test(c, now) &&
      tags.every((t) => c.tags.includes(t)) &&
      (!q ||
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (digits(q).length >= 3 && digits(c.phone).includes(digits(q)))),
  );

  // Before creating, look for someone with the same phone or email (merging is manual, so don't make more duplicates).
  const match =
    (digits(draft.phone).length >= 7 && customers.find((c) => digits(c.phone).endsWith(digits(draft.phone).slice(-9)))) ||
    (draft.email.includes("@") && customers.find((c) => c.email?.toLowerCase() === draft.email.trim().toLowerCase())) ||
    null;
  const errors = { name: draft.name.trim() ? null : t("nameError"), phone: digits(draft.phone).length >= 9 ? null : t("phoneError") };

  function add(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (errors.name || errors.phone || match) return;
    const c: Customer = {
      id: `new-${customers.length}`,
      name: draft.name.trim(),
      company: draft.company.trim() || undefined,
      phone: draft.phone.trim(),
      email: draft.email.trim() || undefined,
      language: "English",
      type: draft.company.trim() ? "Business" : "Individual",
      tags: draft.tag ? [draft.tag] : [],
      ownerId: viewer.memberId,
      teamId: teams[0]?.id ?? "",
      source: "Added by hand",
      createdAt: now,
      lastContact: null,
      deals: [],
      tasks: [],
      orders: [],
      timeline: [],
    };
    setCustomers([c, ...customers]);
    setAdding(false);
    setTried(false);
    setDraft({ name: "", phone: "", email: "", company: "", tag: "" });
  }

  const input = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base placeholder:text-muted";

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="sr-only">{t("title")}</h1>
        <label className="relative flex items-center">
          <span className="sr-only">{t("segment")}</span>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as typeof segment)}
            className="title cursor-pointer appearance-none bg-transparent pe-7 text-3xl [field-sizing:content] sm:text-4xl"
          >
            {SEGMENTS.map((s) => (
              <option key={s.key} value={s.key}>{t(`segments.${s.key}`)}</option>
            ))}
          </select>
          <CaretDown size={18} className="pointer-events-none absolute end-0 text-muted" aria-hidden="true" />
        </label>
        <span className="text-sm tabular-nums text-muted">{list.length}</span>
        <div className="ms-auto flex items-center gap-2">
          <button type="button" disabled className={buttonClass("ghost", "sm")} title={t("importTitle")}>{t("import")}</button>
          {canEdit && !adding && (
            <button type="button" onClick={() => setAdding(true)} className={buttonClass("primary", "sm")}>
              <Plus size={16} aria-hidden="true" /> {t("add")}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">{t("searchLabel")}</span>
          <MagnifyingGlass size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="min-h-10 w-full rounded-full border border-input bg-surface ps-9 pe-4 text-sm placeholder:text-muted"
          />
        </label>
        {tags.map((tag) => (
          <button key={tag} type="button" onClick={() => setTags(tags.filter((x) => x !== tag))} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary-soft px-3 text-sm font-medium text-primary" aria-label={t("removeTag", { tag })}>
            {tag} <X size={14} aria-hidden="true" />
          </button>
        ))}
        <label className="relative">
          <span className="sr-only">{t("filterTag")}</span>
          <select
            value=""
            onChange={(e) => e.target.value && setTags([...tags, e.target.value])}
            className="min-h-9 cursor-pointer appearance-none rounded-full border border-dashed border-input bg-transparent ps-3 pe-3 text-sm text-muted hover:text-text"
          >
            <option value="">{t("addTag")}</option>
            {allTags.filter((tag) => !tags.includes(tag)).map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
      </div>

      {adding && (
        <form onSubmit={add} className="grid gap-4 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-2)] ring-1 ring-border" aria-label={t("form")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              {t("name")}
              <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus aria-invalid={tried && !!errors.name} />
              {tried && errors.name && <span role="alert" className="font-normal text-fail">{errors.name}</span>}
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("phone")}
              <input className={input} type="tel" dir="ltr" placeholder="+971 50 123 4567" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} aria-invalid={tried && !!errors.phone} />
              {tried && errors.phone ? <span role="alert" className="font-normal text-fail">{errors.phone}</span> : <span className="font-normal text-muted">{t("phoneHelp")}</span>}
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("email")} <span className="sr-only">{tAll("common.optionalSr")}</span>
              <input className={input} type="email" dir="ltr" placeholder={tAll("common.optional")} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("company")} <span className="sr-only">{tAll("common.optionalSr")}</span>
              <input className={input} placeholder={tAll("common.optional")} value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("tag")}
              <select className={input} value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })}>
                <option value="">{t("noTag")}</option>
                {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>
          </div>
          {match && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] bg-warn-soft p-3 text-sm">
              <span>{t.rich(digits(draft.phone).length >= 7 && digits(match.phone).endsWith(digits(draft.phone).slice(-9)) ? "existsPhone" : "existsEmail", { name: <strong className="font-semibold">{match.name}</strong> })}</span>
              <Link href={`${base}/customers/${match.id}`} className={buttonClass("secondary", "sm")}>{t("openExisting", { name: match.name.split(" ")[0] })}</Link>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setTried(false); }} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
            <button type="submit" disabled={!!match} className={buttonClass("primary", "sm")}>{t("submit")}</button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <p className="rounded-[var(--radius-panel)] bg-surface p-8 text-center text-muted shadow-[var(--shadow-1)] ring-1 ring-border">
          {q || tags.length ? t("emptyFiltered") : t("empty")}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-5 py-3 text-start font-medium">{t("cols.name")}</th>
                  <th scope="col" className="px-3 py-3 text-start font-medium">{t("cols.lastContact")}</th>
                  <th scope="col" className="px-3 py-3 text-start font-medium">{t("cols.deal")}</th>
                  <th scope="col" className="hidden px-3 py-3 text-start font-medium lg:table-cell">{t("cols.tags")}</th>
                  <th scope="col" className="px-5 py-3 text-start font-medium">{t("cols.owner")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const deal = c.deals.find((d) => d.stage === "new" || d.stage === "quoted" || d.stage === "negotiating") ?? c.deals[0];
                  return (
                    <tr key={c.id} className="relative border-b border-border transition-colors last:border-0 hover:bg-surface-2">
                      <td className="px-5 py-3">
                        <Link href={`${base}/customers/${c.id}`} className="font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-[var(--radius-control)] focus-visible:after:ring-2 focus-visible:after:ring-ring">
                          <bdi>{c.name}</bdi>
                        </Link>
                        <span className="block truncate text-muted">{c.company ?? c.area ?? valueLabel(tAll, "customerType", c.type)}</span>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {c.lastContact ? (
                          <span className="inline-flex items-center gap-1.5">
                            {c.lastContact.channel === "email" ? <EnvelopeSimple size={16} aria-label={tAll("timeline.channel.email")} /> : <WhatsappLogo size={16} aria-label={tAll("timeline.channel.whatsapp")} />}
                            {fmt.ago(c.lastContact.at, now)}
                          </span>
                        ) : tAll("common.never")}
                      </td>
                      <td className="px-3 py-3">
                        {deal ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <Badge tone={STAGE[deal.stage][1]}>{tAll(`stages.${deal.stage}`)}</Badge>
                            {canSeeDealValue(viewer, deal.ownerId) && <span className="tabular-nums text-muted">{fmt.aed(deal.fils)}</span>}
                          </span>
                        ) : <span className="text-muted">{tAll("common.none")}</span>}
                      </td>
                      <td className="hidden px-3 py-3 lg:table-cell">
                        <span className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{tag}</span>)}
                          {c.tags.length > 2 && <span className="text-xs text-muted">+{c.tags.length - 2}</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted">{name(c.ownerId)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phone rows */}
          <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border md:hidden">
            {list.map((c) => (
              <li key={c.id} className="border-b border-border last:border-0">
                <Link href={`${base}/customers/${c.id}`} className="grid gap-0.5 px-4 py-3 hover:bg-surface-2">
                  <span className="flex items-baseline justify-between gap-3">
                    <bdi className="truncate font-medium">{c.name}</bdi>
                    <span className="shrink-0 text-xs text-muted">{c.lastContact ? fmt.ago(c.lastContact.at, now) : tAll("common.never")}</span>
                  </span>
                  <span className="truncate text-sm text-muted">{[c.company, c.tags.join(", ")].filter(Boolean).join(" · ") || valueLabel(tAll, "customerType", c.type)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
