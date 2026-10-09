"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import {
  ArrowLeft,
  ArrowsLeftRight,
  Buildings,
  ChatCircle,
  CheckSquare,
  ClockCounterClockwise,
  DotsThree,
  DownloadSimple,
  EnvelopeSimple,
  Handshake,
  NotePencil,
  PushPin,
  ShieldCheck,
  ShoppingBag,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { canSeeDealValue, type Viewer } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { ChannelMark } from "@/components/channels/channel-mark";
import type { ChannelKey } from "@/components/channels/catalog";
import { useFormat, useT } from "@/i18n/client";
import { lineText, valueLabel } from "@/i18n/labels";
import type { Person, Team } from "@/components/inbox/types";
import { LIFECYCLES, type Company, type Consent, type CustomFieldDef, type Customer, type Lifecycle, type TimelineKind } from "./types";
import { STAGE } from "@/components/deals/stages";
import { stamp } from "@/components/inbox/store";

const KIND: Record<TimelineKind, { Icon: Icon; group: Filter }> = {
  chat: { Icon: ChatCircle, group: "chats" },
  email: { Icon: EnvelopeSimple, group: "email" },
  note: { Icon: NotePencil, group: "notes" },
  handoff: { Icon: ArrowsLeftRight, group: "chats" },
  deal: { Icon: Handshake, group: "deals" },
  order: { Icon: ShoppingBag, group: "orders" },
  task: { Icon: CheckSquare, group: "deals" },
  activity: { Icon: ClockCounterClockwise, group: "activity" },
};
type Filter = "all" | "chats" | "email" | "deals" | "orders" | "notes" | "activity";
const FILTERS: Filter[] = ["all", "chats", "email", "deals", "orders", "notes", "activity"];

interface Props {
  c: Customer;
  duplicate: Customer | null;
  company: Company | null;
  suggestedCompany: Company | null;
  fields: CustomFieldDef[];
  people: Person[];
  teams: Team[];
  viewer: Viewer;
  now: number;
  base: string;
  canEdit: boolean;
  canMerge: boolean;
  /** Owners and admins: erase and export a person's data (decided 2026-10-07). */
  canErase: boolean;
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-2.5 border-t border-border pt-4">
      <h2 className="flex items-center gap-1.5 text-xs font-medium text-muted">{icon}{title}</h2>
      {children}
    </section>
  );
}

/* The contact page: who they are and how to reach them on the side, everything that happened in one timeline. */
export function CustomerPage({ c: initial, duplicate, company: initialCompany, suggestedCompany, fields, people, teams, viewer, now, base, canEdit, canMerge, canErase }: Props) {
  const [c, setC] = useState(initial);
  const [company, setCompany] = useState(initialCompany);
  const [suggestion, setSuggestion] = useState(suggestedCompany);
  const [filter, setFilter] = useState<Filter>("all");
  const [erasing, setErasing] = useState(false);
  const [typed, setTyped] = useState("");
  const [erased, setErased] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const t = useT("customer");
  const tc = useT("customers");
  const tAll = useT();
  const fmt = useFormat();
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? tAll("common.nobody");
  const items = c.timeline.filter((x) => filter === "all" || KIND[x.kind].group === filter);
  const present = new Set(c.timeline.map((x) => KIND[x.kind].group));
  const ordersTotal = c.orders.reduce((s, o) => s + o.fils, 0);
  const first = c.name.split(" ")[0];

  function log(key: string, vars: Record<string, string | { t: string }>) {
    return { id: `act-${c.timeline.length}`, at: stamp(), kind: "activity" as const, title: { key, vars }, by: name(viewer.memberId) };
  }
  function setLifecycle(l: Lifecycle) {
    setC({ ...c, lifecycle: l, timeline: [log("timeline.stageChanged", { stage: { t: `customers.lifecycle.${l}` } }), ...c.timeline] });
  }
  function setConsent(ch: ChannelKey, status: Consent["status"]) {
    setC({
      ...c,
      consent: { ...c.consent, [ch]: { status, at: stamp(), source: t("privacy.changedByTeam") } },
      timeline: [log(status === "in" ? "timeline.consentIn" : "timeline.consentOut", { channel: { t: `channels.${ch}` } }), ...c.timeline],
    });
  }
  function exportData() {
    // Everything held about the person, as one file (GDPR access request). Downloads in the browser only.
    const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${c.name.replace(/[^\w-]+/g, "-").toLowerCase()}-data.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus(t("privacy.exported"));
  }

  if (erased) {
    return (
      <div className="grid gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-1 ring-border">
        <p className="flex items-center gap-2 font-semibold"><ShieldCheck size={20} className="text-done" aria-hidden="true" />{t("privacy.erasedTitle")}</p>
        <p className="text-muted">{t("privacy.erasedBody")}</p>
        <Link href={`${base}/customers`} className={buttonClass("secondary", "md", "w-fit")}>{t("back")}</Link>
      </div>
    );
  }

  const rows: [string, React.ReactNode][] = [
    ...(c.area ? [[t("rows.area"), c.area] as [string, React.ReactNode]] : []),
    [t("rows.language"), valueLabel(tAll, "language", c.language)],
    [t("rows.source"), valueLabel(tAll, "source", c.source)],
    [t("rows.team"), teams.find((x) => x.id === c.teamId)?.name ?? tAll("common.none")],
    [t("rows.owner"), name(c.ownerId)],
    [t("rows.since"), fmt.shortDate(c.createdAt)],
  ];

  return (
    <div className="grid gap-6">
      <Link href={`${base}/customers`} className="-mb-2 inline-flex min-h-9 w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <h1 className="title text-3xl sm:text-4xl"><bdi>{c.name}</bdi></h1>
          <p className="flex flex-wrap items-center gap-2 text-muted">
            {company ? (
              <Link href={`${base}/customers/companies/${company.id}`} className="inline-flex items-center gap-1 text-text hover:underline"><Buildings size={16} aria-hidden="true" />{company.name}</Link>
            ) : c.company}
            {canEdit ? (
              <select value={c.lifecycle} onChange={(e) => setLifecycle(e.target.value as Lifecycle)} aria-label={t("stageLabel")} className="min-h-8 rounded-full border border-input bg-surface px-2.5 text-sm text-text">
                {LIFECYCLES.map((l) => <option key={l} value={l}>{tc(`lifecycle.${l}`)}</option>)}
              </select>
            ) : <Badge>{tc(`lifecycle.${c.lifecycle}`)}</Badge>}
            {c.doNotContact && <Badge tone="fail">{t("privacy.dnc")}</Badge>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {c.conversationId && <Link href={`${base}/inbox?c=${c.conversationId}`} className={buttonClass("primary", "sm")}>{t("openChat")}</Link>}
          <Link href={`${base}/deals`} className={buttonClass("secondary", "sm")}>{t("newDeal")}</Link>
          {(canMerge || canErase) && (
            <details className="relative">
              <summary className={buttonClass("ghost", "sm", "!px-2 list-none [&::-webkit-details-marker]:hidden")} aria-label={tAll("common.moreActions")}>
                <DotsThree size={22} weight="bold" aria-hidden="true" />
              </summary>
              <div className="absolute end-0 top-full z-20 mt-1 grid min-w-56 rounded-[var(--radius-control)] border border-border bg-surface p-1 shadow-[var(--shadow-2)]">
                {canMerge && duplicate && (
                  <Link href={`${base}/customers/merge?a=${c.id}&b=${duplicate.id}`} className="flex min-h-11 items-center rounded px-3 hover:bg-surface-2">{t("mergeWith", { name: duplicate.name })}</Link>
                )}
                {canErase && <button type="button" onClick={exportData} className="flex min-h-11 items-center gap-2 rounded px-3 text-start hover:bg-surface-2"><DownloadSimple size={16} aria-hidden="true" />{t("privacy.export")}</button>}
                {canErase && <button type="button" onClick={() => setErasing(true)} className="min-h-11 rounded px-3 text-start text-fail hover:bg-surface-2">{t("erase")}</button>}
              </div>
            </details>
          )}
        </div>
      </header>

      {status && <p role="status" className="rounded-[var(--radius-control)] bg-done-soft px-4 py-2 text-sm">{status}</p>}

      {erasing && (
        <div role="alert" className="grid gap-3 rounded-[var(--radius-panel)] bg-fail-soft p-4">
          <p className="text-sm"><strong className="font-semibold">{t("eraseTitle", { name: c.name })}</strong> {t("eraseBody")}</p>
          <label className="grid gap-1 text-sm sm:max-w-sm">
            {t("privacy.eraseType", { name: c.name })}
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setErasing(false); setTyped(""); }} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
            <button type="button" disabled={typed.trim() !== c.name} onClick={() => setErased(true)} className={buttonClass("destructive", "sm")}>{t("eraseButton", { name: first })}</button>
          </div>
        </div>
      )}

      {duplicate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-warn-soft px-4 py-3 text-sm">
          <p className="flex gap-2">
            <WarningCircle size={20} className="shrink-0 text-warn" aria-hidden="true" />
            <span>
              <strong className="font-semibold">{tAll("panel.possibleDuplicate")}</strong>{" "}
              {t.rich(duplicate.email && duplicate.email === c.email ? "duplicateEmail" : "duplicateCompany", {
                name: <Link href={`${base}/customers/${duplicate.id}`} className="underline underline-offset-2">{duplicate.name}</Link>,
              })}
            </span>
          </p>
          {canMerge && <Link href={`${base}/customers/merge?a=${c.id}&b=${duplicate.id}`} className={buttonClass("secondary", "sm")}>{t("compareMerge")}</Link>}
        </div>
      )}

      {suggestion && !company && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-surface-2 px-4 py-3 text-sm">
          <p className="flex gap-2"><Buildings size={20} className="shrink-0 text-muted" aria-hidden="true" />{t("companySuggest", { company: suggestion.name, domain: suggestion.domain ?? "" })}</p>
          {canEdit && (
            <span className="flex gap-2">
              <button type="button" onClick={() => setSuggestion(null)} className={buttonClass("ghost", "sm")}>{t("companyNo")}</button>
              <button type="button" onClick={() => { setCompany(suggestion); setC({ ...c, company: suggestion.name, companyId: suggestion.id }); }} className={buttonClass("secondary", "sm")}>{t("companyYes")}</button>
            </span>
          )}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Who they are and how to reach them */}
        <aside aria-label={t("details")} className="grid gap-4 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border lg:sticky lg:top-6">
          {c.pinned && (
            <p className="grid gap-1 rounded-[var(--radius-control)] border border-dashed border-note-border bg-note-soft px-3 py-2 text-sm">
              <span className="flex items-center gap-1 text-xs font-medium text-muted"><PushPin size={14} aria-hidden="true" />{t("pinnedBy", { name: name(c.pinned.byId) })}</span>
              <span dir="auto">{c.pinned.text}</span>
            </p>
          )}

          <section className="grid gap-2">
            <h2 className="text-xs font-medium text-muted">{t("channels")}</h2>
            <ul className="grid gap-2 text-sm">
              {c.identities.map((i) => {
                const consent = c.consent[i.ch]?.status ?? "unknown";
                return (
                  <li key={`${i.ch}-${i.handle}`} className="flex items-center gap-2.5">
                    <ChannelMark ch={i.ch} size={20} label={tAll(`channels.${i.ch}`)} />
                    <span className="min-w-0 flex-1 truncate" dir="ltr">{i.handle}</span>
                    <span className={`shrink-0 text-xs ${consent === "in" ? "text-done" : consent === "out" ? "text-fail" : "text-muted"}`} title={c.consent[i.ch]?.source}>{t(`privacy.consent.${consent}`)}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <dl className="grid gap-2 border-t border-border pt-4 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted">{k}</dt>
                <dd className="min-w-0 text-end">{v}</dd>
              </div>
            ))}
          </dl>

          {fields.length > 0 && (
            <Card title={t("fields")}>
              <dl className="grid gap-2 text-sm">
                {fields.map((f) => (
                  <div key={f.key} className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted">{f.label}</dt>
                    <dd className="min-w-0 text-end">{c.fields[f.key] ? (f.type === "date" ? fmt.shortDate(Date.parse(c.fields[f.key])) : c.fields[f.key]) : <span className="text-muted">—</span>}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {c.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label={tAll("common.tags")}>
              {c.tags.map((tag) => <li key={tag} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{tag}</li>)}
            </ul>
          )}

          {c.deals.length > 0 && (
            <Card title={t("deals")}>
              {c.deals.map((d) => (
                <div key={d.id} className="grid gap-0.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium"><bdi>{d.title}</bdi></span>
                    <Badge tone={STAGE[d.stage][1]}>{tAll(`stages.${d.stage}`)}</Badge>
                  </div>
                  <span className="text-muted">{canSeeDealValue(viewer, d.ownerId) ? <span className="tabular-nums text-text">{fmt.money(d.fils)}</span> : tAll("panel.valueHidden")} · {name(d.ownerId)}</span>
                </div>
              ))}
            </Card>
          )}
          {c.tasks.length > 0 && (
            <Card title={t("followUps")}>
              {c.tasks.map((task) => (
                <p key={task.id} className="text-sm"><bdi>{task.text}</bdi><span className="block text-muted">{name(task.ownerId)} · {tAll("panel.due", { when: valueLabel(tAll, "due", task.due) })}</span></p>
              ))}
            </Card>
          )}
          {c.orders.length > 0 && (
            <Card title={t("orders")}>
              <p className="text-sm"><span className="tabular-nums">{fmt.money(ordersTotal)}</span> <span className="text-muted">{t("ordersAcross", { count: c.orders.length })}</span></p>
            </Card>
          )}

          {/* Privacy: marketing consent per channel and the do-not-contact switch (decided 2026-10-07). */}
          <Card title={t("privacy.title")} icon={<ShieldCheck size={14} aria-hidden="true" />}>
            <ul className="grid gap-2 text-sm">
              {c.identities.filter((i) => i.ch !== "voice" && i.ch !== "webchat").map((i) => {
                const consent = c.consent[i.ch];
                return (
                  <li key={i.ch} className="grid gap-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <span>{t("privacy.marketingOn", { channel: tAll(`channels.${i.ch}`) })}</span>
                      {canEdit ? (
                        <select value={consent?.status ?? "unknown"} onChange={(e) => setConsent(i.ch, e.target.value as Consent["status"])} className="min-h-8 rounded-[var(--radius-control)] border border-input bg-surface px-2 text-xs" aria-label={t("privacy.marketingOn", { channel: tAll(`channels.${i.ch}`) })}>
                          {(["in", "out", "unknown"] as const).map((s) => <option key={s} value={s}>{t(`privacy.consent.${s}`)}</option>)}
                        </select>
                      ) : <span className="text-muted">{t(`privacy.consent.${consent?.status ?? "unknown"}`)}</span>}
                    </span>
                    {consent?.at && <span className="text-xs text-muted">{t("privacy.since", { date: fmt.shortDate(consent.at), source: consent.source ?? "" })}</span>}
                  </li>
                );
              })}
            </ul>
            <label className="flex items-start justify-between gap-3 text-sm">
              <span className="grid"><span>{t("privacy.dncLabel")}</span><span className="text-xs text-muted">{t("privacy.dncHelp")}</span></span>
              <input type="checkbox" role="switch" checked={!!c.doNotContact} disabled={!canEdit} onChange={(e) => setC({ ...c, doNotContact: e.target.checked })} className="mt-0.5 size-5 accent-[var(--primary)]" />
            </label>
          </Card>
        </aside>

        {/* Everything that happened */}
        <section aria-label={t("timeline")} className="grid gap-4">
          {canEdit && (
            note === null ? (
              <button type="button" onClick={() => setNote("")} className="flex min-h-11 items-center gap-2 rounded-[var(--radius-panel)] border border-dashed border-border px-4 text-start text-sm text-muted hover:text-text">
                <NotePencil size={18} aria-hidden="true" /> {t("addNote")}
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  setC({ ...c, timeline: [{ id: `n-${c.timeline.length}`, at: stamp(), kind: "note", title: { key: "timeline.note" }, body: note.trim(), by: name(viewer.memberId) }, ...c.timeline] });
                  setNote(null);
                }}
                className="grid gap-2 rounded-[var(--radius-panel)] border border-dashed border-note-border bg-note-soft p-3"
              >
                <label className="sr-only" htmlFor="contact-note">{t("addNote")}</label>
                <textarea id="contact-note" autoFocus rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder", { name: first })} className="w-full resize-none bg-transparent text-sm focus:outline-none" dir="auto" />
                <span className="flex justify-end gap-2">
                  <button type="button" onClick={() => setNote(null)} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
                  <button type="submit" disabled={!note.trim()} className={buttonClass("secondary", "sm")}>{t("saveNote")}</button>
                </span>
              </form>
            )
          )}

          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("show")}>
            {FILTERS.filter((f) => f === "all" || present.has(f)).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-9 rounded-full px-3.5 text-sm transition-colors ${filter === f ? "bg-primary-soft font-semibold text-primary" : "text-muted hover:bg-surface-2 hover:text-text"}`}
              >
                {t(`filters.${f}`)}
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <p className="rounded-[var(--radius-panel)] bg-surface p-6 text-muted shadow-[var(--shadow-1)] ring-1 ring-border">{t("empty")}</p>
          ) : (
            <ol className="grid">
              {items.map((item, i) => {
                const { Icon } = KIND[item.kind];
                const newDay = i === 0 || !fmt.sameDay(items[i - 1].at, item.at);
                // Deal, order and task rows keep a code in `body`; everything else is people's own words.
                const body =
                  item.bodyLine ? lineText(tAll, item.bodyLine)
                  : !item.body ? null
                  : item.kind === "deal" ? t("stage", { stage: tAll(`stages.${item.body}`) })
                  : item.kind === "order" ? valueLabel(tAll, "orderState", item.body)
                  : item.kind === "task" ? tAll("panel.due", { when: valueLabel(tAll, "due", item.body) })
                  : item.body;
                const row = (
                  <>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-muted shadow-[var(--shadow-1)] ring-1 ring-border"><Icon size={18} aria-hidden="true" /></span>
                    <span className="grid min-w-0 flex-1 gap-0.5 pt-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{lineText(tAll, item.title)}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{fmt.time(item.at)}</span>
                      </span>
                      {body && <span className={`text-sm text-muted ${item.kind === "note" ? "rounded-[var(--radius-control)] border border-dashed border-note-border bg-note-soft px-3 py-2 text-text" : "line-clamp-2"}`} dir="auto">{body}</span>}
                      {item.by && <span className="text-xs text-muted">{item.by}</span>}
                    </span>
                  </>
                );
                return (
                  <Fragment key={item.id}>
                    {newDay && <li className="pb-2 pt-4 text-xs font-medium text-muted first:pt-0">{fmt.dayLabel(item.at, now)}</li>}
                    <li className="relative ps-0">
                      {item.href ? (
                        <Link href={`${base}/${item.href}`} className="flex gap-3 rounded-[var(--radius-control)] p-2 transition-colors hover:bg-surface">{row}</Link>
                      ) : (
                        <div className="flex gap-3 p-2">{row}</div>
                      )}
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
