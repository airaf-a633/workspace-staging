"use client";

import Link from "next/link";
import { useState } from "react";
import { Buildings, CaretDown, DownloadSimple, MagnifyingGlass, Plus, Tag, Trash, UploadSimple, UserCircle, X } from "@phosphor-icons/react";
import { ChannelMark } from "@/components/channels/channel-mark";
import { CHANNELS, type ChannelKey } from "@/components/channels/catalog";
import { canSeeDealValue, type Viewer } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { useFormat, useT } from "@/i18n/client";
import { valueLabel } from "@/i18n/labels";
import type { Person, Team } from "@/components/inbox/types";
import { SEGMENTS } from "./sample";
import { LIFECYCLES, type Company, type Customer, type Lifecycle } from "./types";
import { STAGE } from "@/components/deals/stages";

const digits = (s = "") => s.replace(/\D/g, "");

interface Props {
  customers: Customer[];
  companies: (Company & { people: Customer[] })[];
  people: Person[];
  teams: Team[];
  viewer: Viewer;
  now: number;
  base: string;
  canEdit: boolean;
  /** Owners and admins may delete contacts in bulk and export them. */
  canBulkDelete: boolean;
  initialTab?: "people" | "companies";
}

const LIFE_TONE: Record<Lifecycle, "new" | "done" | "warn"> = { lead: "new", customer: "done", repeat: "done", churned: "warn" };

/* Contacts (decided 2026-10-07): people and companies, every channel each person uses, filters that can be
   saved as segments, and actions on many at once. A calm table on desktop, two-line rows on phones. */
export function CustomerList({ customers: initial, companies, people, teams, viewer, now, base, canEdit, canBulkDelete, initialTab = "people" }: Props) {
  const [customers, setCustomers] = useState(initial);
  const [tab, setTab] = useState(initialTab);
  const [segment, setSegment] = useState<string>("all");
  const [saved, setSaved] = useState<{ key: string; name: string; tags: string[]; life: Lifecycle | ""; ch: ChannelKey | "" }[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [life, setLife] = useState<Lifecycle | "">("");
  const [ch, setCh] = useState<ChannelKey | "">("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", email: "", company: "", tag: "" });
  const [tried, setTried] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [bulk, setBulk] = useState<"tag" | "owner" | "stage" | "delete" | null>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const t = useT("customers");
  const tAll = useT();
  const fmt = useFormat();
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? tAll("common.nobody");
  const allTags = [...new Set(customers.flatMap((c) => c.tags))].sort();
  const usedChannels = CHANNELS.filter((x) => customers.some((c) => c.identities.some((i) => i.ch === x.key)));
  const seg = SEGMENTS.find((s) => s.key === segment);
  const savedSeg = saved.find((s) => s.key === segment);
  const q = query.trim().toLowerCase();
  const list = customers.filter(
    (c) =>
      (seg ? seg.test(c, now) : true) &&
      (savedSeg ? savedSeg.tags.every((x) => c.tags.includes(x)) && (!savedSeg.life || c.lifecycle === savedSeg.life) && (!savedSeg.ch || c.identities.some((i) => i.ch === savedSeg.ch)) : true) &&
      tags.every((x) => c.tags.includes(x)) &&
      (!life || c.lifecycle === life) &&
      (!ch || c.identities.some((i) => i.ch === ch)) &&
      (!q ||
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        c.identities.some((i) => i.handle.toLowerCase().includes(q)) ||
        (digits(q).length >= 3 && digits(c.phone).includes(digits(q)))),
  );
  const filtering = tags.length > 0 || !!life || !!ch;
  const allPicked = list.length > 0 && list.every((c) => picked.includes(c.id));

  // Before creating, look for someone with the same phone or email (merging is manual, so don't make more duplicates).
  const match =
    (digits(draft.phone).length >= 7 && customers.find((c) => digits(c.phone).endsWith(digits(draft.phone).slice(-9)))) ||
    (draft.email.includes("@") && customers.find((c) => c.email?.toLowerCase() === draft.email.trim().toLowerCase())) ||
    null;
  const errors = {
    name: draft.name.trim() ? null : t("nameError"),
    // A phone or an email: contacts can come from any channel now, not only WhatsApp.
    reach: digits(draft.phone).length >= 9 || draft.email.includes("@") ? null : t("reachError"),
  };

  function add(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (errors.name || errors.reach || match) return;
    const identities = [
      ...(draft.phone.trim() ? [{ ch: "whatsapp" as const, handle: draft.phone.trim() }] : []),
      ...(draft.email.trim() ? [{ ch: "email" as const, handle: draft.email.trim() }] : []),
    ];
    const c: Customer = {
      id: `new-${customers.length}`,
      name: draft.name.trim(),
      company: draft.company.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      email: draft.email.trim() || undefined,
      language: "English",
      type: draft.company.trim() ? "Business" : "Individual",
      lifecycle: "lead",
      identities,
      consent: Object.fromEntries(identities.map((i) => [i.ch, { status: "unknown" as const }])),
      fields: {},
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

  function saveSegment() {
    const label = [...tags, life && t(`lifecycle.${life}`), ch && tAll(`channels.${ch}`)].filter(Boolean).join(" · ");
    const key = `saved-${saved.length}`;
    setSaved([...saved, { key, name: label, tags, life, ch }]);
    setSegment(key);
    setTags([]);
    setLife("");
    setCh("");
  }

  function applyBulk() {
    const n = picked.length;
    if (bulk === "delete") {
      setCustomers(customers.filter((c) => !picked.includes(c.id)));
      setToast(t("bulk.deleted", { count: n }));
    } else if (bulk === "tag" && bulkValue.trim()) {
      setCustomers(customers.map((c) => (picked.includes(c.id) && !c.tags.includes(bulkValue.trim()) ? { ...c, tags: [...c.tags, bulkValue.trim()] } : c)));
      setToast(t("bulk.tagged", { count: n, tag: bulkValue.trim() }));
    } else if (bulk === "owner" && bulkValue) {
      setCustomers(customers.map((c) => (picked.includes(c.id) ? { ...c, ownerId: bulkValue } : c)));
      setToast(t("bulk.owned", { count: n, name: name(bulkValue) }));
    } else if (bulk === "stage" && bulkValue) {
      setCustomers(customers.map((c) => (picked.includes(c.id) ? { ...c, lifecycle: bulkValue as Lifecycle } : c)));
      setToast(t("bulk.staged", { count: n, stage: t(`lifecycle.${bulkValue as Lifecycle}`) }));
    } else return;
    setPicked([]);
    setBulk(null);
    setBulkValue("");
  }

  const input = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base placeholder:text-muted";
  const chip = "min-h-9 cursor-pointer appearance-none rounded-full border border-dashed border-input bg-transparent ps-3 pe-3 text-sm text-muted hover:text-text";

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="sr-only">{t("title")}</h1>
        <div role="tablist" aria-label={t("title")} className="inline-flex rounded-full bg-surface-2 p-0.5">
          {(["people", "companies"] as const).map((k) => (
            <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium ${tab === k ? "bg-surface text-text shadow-[var(--shadow-1)]" : "text-muted hover:text-text"}`}>
              {k === "people" ? <UserCircle size={16} aria-hidden="true" /> : <Buildings size={16} aria-hidden="true" />}
              {t(`tabs.${k}`)} <span className="tabular-nums text-muted">{k === "people" ? customers.length : companies.length}</span>
            </button>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-2">
          {canEdit && (
            <Link href={`${base}/customers/import`} className={buttonClass("ghost", "sm")}>
              <UploadSimple size={16} aria-hidden="true" /> {t("import")}
            </Link>
          )}
          {canEdit && tab === "people" && !adding && (
            <button type="button" onClick={() => setAdding(true)} className={buttonClass("primary", "sm")}>
              <Plus size={16} aria-hidden="true" /> {t("add")}
            </button>
          )}
        </div>
      </header>

      {tab === "companies" ? (
        <CompanyTable companies={companies} base={base} name={name} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex items-center">
              <span className="sr-only">{t("segment")}</span>
              <select value={segment} onChange={(e) => setSegment(e.target.value)} className="title cursor-pointer appearance-none bg-transparent pe-7 text-2xl [field-sizing:content]">
                {SEGMENTS.map((s) => <option key={s.key} value={s.key}>{t(`segments.${s.key}`)}</option>)}
                {saved.length > 0 && (
                  <optgroup label={t("savedSegments")}>
                    {saved.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                  </optgroup>
                )}
              </select>
              <CaretDown size={18} className="pointer-events-none absolute end-0 text-muted" aria-hidden="true" />
            </label>
            <span className="text-sm tabular-nums text-muted">{list.length}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative w-full sm:w-72">
              <span className="sr-only">{t("searchLabel")}</span>
              <MagnifyingGlass size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} className="min-h-10 w-full rounded-full border border-input bg-surface ps-9 pe-4 text-sm placeholder:text-muted" />
            </label>
            {tags.map((tag) => (
              <button key={tag} type="button" onClick={() => setTags(tags.filter((x) => x !== tag))} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary-soft px-3 text-sm font-medium text-primary" aria-label={t("removeTag", { tag })}>
                {tag} <X size={14} aria-hidden="true" />
              </button>
            ))}
            <label>
              <span className="sr-only">{t("filterTag")}</span>
              <select value="" onChange={(e) => e.target.value && setTags([...tags, e.target.value])} className={chip}>
                <option value="">{t("addTag")}</option>
                {allTags.filter((tag) => !tags.includes(tag)).map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">{t("filterStage")}</span>
              <select value={life} onChange={(e) => setLife(e.target.value as Lifecycle | "")} className={`${chip} ${life ? "border-solid bg-primary-soft font-medium text-primary" : ""}`}>
                <option value="">{t("anyStage")}</option>
                {LIFECYCLES.map((l) => <option key={l} value={l}>{t(`lifecycle.${l}`)}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">{t("filterChannel")}</span>
              <select value={ch} onChange={(e) => setCh(e.target.value as ChannelKey | "")} className={`${chip} ${ch ? "border-solid bg-primary-soft font-medium text-primary" : ""}`}>
                <option value="">{t("anyChannel")}</option>
                {usedChannels.map((x) => <option key={x.key} value={x.key}>{tAll(`channels.${x.key}`)}</option>)}
              </select>
            </label>
            {filtering && <button type="button" onClick={saveSegment} className={buttonClass("ghost", "sm")}>{t("saveSegment")}</button>}
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
                  <input className={input} type="tel" dir="ltr" placeholder="+44 7700 900123" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} aria-invalid={tried && !!errors.reach} />
                  <span className="font-normal text-muted">{t("phoneHelp")}</span>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  {t("email")}
                  <input className={input} type="email" dir="ltr" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} aria-invalid={tried && !!errors.reach} />
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
              {tried && errors.reach && <p role="alert" className="text-sm text-fail">{errors.reach}</p>}
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

          {toast && (
            <p role="status" className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-done-soft px-4 py-2 text-sm">
              {toast}
              <button type="button" onClick={() => setToast(null)} className="text-muted hover:text-text" aria-label={tAll("common.dismiss")}><X size={16} aria-hidden="true" /></button>
            </p>
          )}

          {/* Actions on many: appears once someone is picked. */}
          {picked.length > 0 && canEdit && (
            <div className="sticky top-2 z-10 grid gap-3 rounded-[var(--radius-panel)] bg-surface p-3 shadow-[var(--shadow-2)] ring-1 ring-border">
              <div className="flex flex-wrap items-center gap-2">
                <span className="me-2 text-sm font-medium">{t("bulk.selected", { count: picked.length })}</span>
                <button type="button" onClick={() => { setBulk("tag"); setBulkValue(""); }} className={buttonClass("ghost", "sm")}><Tag size={16} aria-hidden="true" /> {t("bulk.tag")}</button>
                <button type="button" onClick={() => { setBulk("owner"); setBulkValue(""); }} className={buttonClass("ghost", "sm")}><UserCircle size={16} aria-hidden="true" /> {t("bulk.owner")}</button>
                <button type="button" onClick={() => { setBulk("stage"); setBulkValue(""); }} className={buttonClass("ghost", "sm")}>{t("bulk.stage")}</button>
                {canBulkDelete && (
                  <button type="button" onClick={() => setToast(t("bulk.exported", { count: picked.length }))} className={buttonClass("ghost", "sm")}><DownloadSimple size={16} aria-hidden="true" /> {t("bulk.export")}</button>
                )}
                {canBulkDelete && (
                  <button type="button" onClick={() => { setBulk("delete"); setBulkValue(""); }} className={buttonClass("ghost", "sm", "text-fail")}><Trash size={16} aria-hidden="true" /> {t("bulk.delete")}</button>
                )}
                <button type="button" onClick={() => { setPicked([]); setBulk(null); }} className={buttonClass("ghost", "sm", "ms-auto")}>{tAll("common.cancel")}</button>
              </div>
              {bulk && (
                <form onSubmit={(e) => { e.preventDefault(); applyBulk(); }} className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  {bulk === "tag" && <input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} list="bulk-tags" placeholder={t("bulk.tagPlaceholder")} className={`${input} max-w-60 text-sm`} autoFocus aria-label={t("bulk.tag")} />}
                  <datalist id="bulk-tags">{allTags.map((x) => <option key={x} value={x} />)}</datalist>
                  {bulk === "owner" && (
                    <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className={`${input} max-w-60 text-sm`} aria-label={t("bulk.owner")}>
                      <option value="">{t("bulk.choose")}</option>
                      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                  {bulk === "stage" && (
                    <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className={`${input} max-w-60 text-sm`} aria-label={t("bulk.stage")}>
                      <option value="">{t("bulk.choose")}</option>
                      {LIFECYCLES.map((l) => <option key={l} value={l}>{t(`lifecycle.${l}`)}</option>)}
                    </select>
                  )}
                  {bulk === "delete" && (
                    <p className="text-sm">{t("bulk.deleteConfirm", { count: picked.length })}</p>
                  )}
                  <button type="submit" disabled={bulk !== "delete" && !bulkValue.trim()} className={buttonClass(bulk === "delete" ? "destructive" : "primary", "sm")}>
                    {bulk === "delete" ? t("bulk.deleteButton", { count: picked.length }) : t("bulk.apply")}
                  </button>
                </form>
              )}
            </div>
          )}

          {list.length === 0 ? (
            <p className="rounded-[var(--radius-panel)] bg-surface p-8 text-center text-muted shadow-[var(--shadow-1)] ring-1 ring-border">
              {q || filtering ? t("emptyFiltered") : t("empty")}
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-start text-xs text-muted">
                      {canEdit && (
                        <th scope="col" className="w-10 ps-5">
                          <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? [] : list.map((c) => c.id))} aria-label={t("bulk.selectAll")} className="size-4 accent-[var(--primary)]" />
                        </th>
                      )}
                      <th scope="col" className="px-5 py-3 text-start font-medium">{t("cols.name")}</th>
                      <th scope="col" className="px-3 py-3 text-start font-medium">{t("cols.channels")}</th>
                      <th scope="col" className="px-3 py-3 text-start font-medium">{t("cols.lastContact")}</th>
                      <th scope="col" className="px-3 py-3 text-start font-medium">{t("cols.stage")}</th>
                      <th scope="col" className="hidden px-3 py-3 text-start font-medium xl:table-cell">{t("cols.deal")}</th>
                      <th scope="col" className="px-5 py-3 text-start font-medium">{t("cols.owner")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c) => {
                      const deal = c.deals.find((d) => d.stage === "new" || d.stage === "quoted" || d.stage === "negotiating") ?? c.deals[0];
                      const on = picked.includes(c.id);
                      return (
                        <tr key={c.id} className={`relative border-b border-border transition-colors last:border-0 hover:bg-surface-2 ${on ? "bg-primary-soft/50" : ""}`}>
                          {canEdit && (
                            <td className="relative z-10 ps-5">
                              <input type="checkbox" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])} aria-label={t("bulk.select", { name: c.name })} className="size-4 accent-[var(--primary)]" />
                            </td>
                          )}
                          <td className="px-5 py-3">
                            <Link href={`${base}/customers/${c.id}`} className="font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-[var(--radius-control)] focus-visible:after:ring-2 focus-visible:after:ring-ring">
                              <bdi>{c.name}</bdi>
                            </Link>
                            <span className="block truncate text-muted">{c.company ?? c.area ?? valueLabel(tAll, "customerType", c.type)}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex -space-x-1 rtl:space-x-reverse">
                              {c.identities.slice(0, 4).map((i) => <ChannelMark key={`${i.ch}-${i.handle}`} ch={i.ch} size={20} label={tAll(`channels.${i.ch}`)} className="ring-2 ring-surface" />)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted">{c.lastContact ? fmt.ago(c.lastContact.at, now) : tAll("common.never")}</td>
                          <td className="px-3 py-3"><Badge tone={LIFE_TONE[c.lifecycle]}>{t(`lifecycle.${c.lifecycle}`)}</Badge></td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            {deal ? (
                              <span className="inline-flex flex-wrap items-center gap-2">
                                <Badge tone={STAGE[deal.stage][1]}>{tAll(`stages.${deal.stage}`)}</Badge>
                                {canSeeDealValue(viewer, deal.ownerId) && <span className="tabular-nums text-muted">{fmt.money(deal.fils)}</span>}
                              </span>
                            ) : <span className="text-muted">{tAll("common.none")}</span>}
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
                      <span className="flex items-center gap-2 text-sm text-muted">
                        <span className="flex -space-x-1 rtl:space-x-reverse">{c.identities.slice(0, 3).map((i) => <ChannelMark key={`${i.ch}-${i.handle}`} ch={i.ch} size={16} label={false} className="ring-2 ring-surface" />)}</span>
                        <span className="truncate">{[c.company, t(`lifecycle.${c.lifecycle}`)].filter(Boolean).join(" · ")}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CompanyTable({ companies, base, name }: { companies: (Company & { people: Customer[] })[]; base: string; name: (id: string | null) => string }) {
  const t = useT("customers");
  const fmt = useFormat();
  if (companies.length === 0) return <p className="rounded-[var(--radius-panel)] bg-surface p-8 text-center text-muted ring-1 ring-border">{t("companies.empty")}</p>;
  return (
    <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">
      {companies.map((co) => {
        const open = co.people.flatMap((p) => p.deals).filter((d) => d.stage !== "won" && d.stage !== "lost");
        const orders = co.people.flatMap((p) => p.orders).reduce((s, o) => s + o.fils, 0);
        return (
          <li key={co.id} className="border-b border-border last:border-0">
            <Link href={`${base}/customers/companies/${co.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface-2 text-muted" aria-hidden="true"><Buildings size={20} /></span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <bdi className="font-medium">{co.name}</bdi>
                <span className="truncate text-sm text-muted">{[co.domain, co.industry, co.location].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="hidden shrink-0 text-end text-sm sm:grid">
                <span>{t("companies.people", { count: co.people.length })}</span>
                <span className="text-muted">{open.length ? t("companies.openDeals", { count: open.length }) : orders ? fmt.moneyWhole(orders / 100) : "—"}</span>
              </span>
              <span className="hidden w-24 shrink-0 truncate text-sm text-muted md:block">{name(co.ownerId)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
