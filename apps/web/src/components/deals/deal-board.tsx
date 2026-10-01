"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CaretDown, Plus, WarningCircle, X } from "@phosphor-icons/react";
import { canSeeDealValue, covers, type Viewer } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { useFormat, useT } from "@/i18n/client";
import { lineText, valueLabel } from "@/i18n/labels";
import type { Person, Team } from "@/components/inbox/types";
import { dealNeed, type BoardDeal } from "./sample";
import { LOST_REASONS, OPEN_STAGES, STAGE, type OpenStage } from "./stages";

type View = "mine" | "teams" | "all";

interface Props {
  deals: BoardDeal[];
  people: Person[];
  teams: Team[];
  viewer: Viewer;
  now: number;
  base: string;
  /** A deal to open on arrival, e.g. from "Needs you now". */
  initialOpen?: string | null;
}

const ref = (d: BoardDeal) => ({ teamId: d.teamId, holderId: d.ownerId });
const toFils = (v: string) => Math.round(Number(v.replace(/[^\d.]/g, "")) * 100) || 0;

/* The Deals board (decided 2026-09-30): compact cards, drag between stages, a side sheet for the details. */
export function DealBoard({ deals: initial, people, teams, viewer, now, base, initialOpen = null }: Props) {
  const me = viewer.memberId;
  const [deals, setDeals] = useState(initial);
  const [view, setView] = useState<View>(viewer.scopes["deals.view"] === "own" ? "mine" : viewer.scopes["deals.view"] === "all" ? "all" : "teams");
  const [closed, setClosed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpen);
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const t = useT("deals");
  const tAll = useT();
  const fmt = useFormat();
  const name = (id: string | null | undefined) => people.find((p) => p.id === id)?.name ?? tAll("common.someone");
  const canView = (d: BoardDeal) => covers(viewer, "deals.view", ref(d));
  const canEdit = (d: BoardDeal) => covers(viewer, "deals.edit", ref(d));
  const money = (d: BoardDeal) => canSeeDealValue(viewer, d.ownerId);
  const allMoney = viewer.scopes["deals.values"] === "all" || viewer.scopes["deals.values"] === "team";
  const canCreate = (viewer.scopes["deals.edit"] ?? "none") !== "none";

  const views: [View, string][] = (
    [
      ["mine", t("views.mine")],
      ["teams", t("views.teams")],
      ["all", t("views.all")],
    ] as [View, string][]
  ).filter(([v]) => (v === "all" ? viewer.scopes["deals.view"] === "all" : v === "teams" ? viewer.scopes["deals.view"] !== "own" : true));

  const visible = deals.filter(canView).filter((d) => (view === "mine" ? d.ownerId === me : view === "teams" ? viewer.teamIds.includes(d.teamId) || d.ownerId === me : true));
  const open = visible.filter((d) => (OPEN_STAGES as readonly string[]).includes(d.stage));
  const done = visible.filter((d) => d.stage === "won" || d.stage === "lost").sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  const selected = deals.find((d) => d.id === openId) ?? null;

  function update(id: string, patch: Partial<BoardDeal>) {
    setDeals((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setOpenId(null), setCreating(false));
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if ((viewer.scopes["deals.view"] ?? "none") === "none") {
    return (
      <div className="grid gap-4">
        <h1 className="title text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="rounded-[var(--radius-panel)] bg-surface p-6 text-muted shadow-[var(--shadow-1)] ring-1 ring-border">{t("noAccess")}</p>
      </div>
    );
  }

  const card = (d: BoardDeal) => {
    const need = dealNeed(d, now);
    return (
      <li key={d.id}>
        <button
          type="button"
          draggable={canEdit(d)}
          onDragStart={(e) => {
            setDragging(d.id);
            e.dataTransfer.setData("text/plain", d.id);
          }}
          onDragEnd={() => setDragging(null)}
          onClick={() => setOpenId(d.id)}
          className={`grid w-full gap-1 rounded-[var(--radius-panel)] bg-surface p-3.5 text-start shadow-[var(--shadow-1)] ring-1 ring-border transition hover:ring-primary/40 ${dragging === d.id ? "opacity-50" : ""} ${openId === d.id ? "ring-2 ring-primary" : ""}`}
        >
          <span className="flex items-baseline justify-between gap-2">
            <bdi className="truncate font-semibold">{d.customerName}</bdi>
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary" title={t("ownerIs", { name: name(d.ownerId) })} aria-label={t("ownerIs", { name: name(d.ownerId) })}>
              {name(d.ownerId).charAt(0)}
            </span>
          </span>
          <span className="line-clamp-2 text-sm text-muted"><bdi>{d.title}</bdi></span>
          {money(d) && <span className="text-sm font-medium tabular-nums">{fmt.aed(d.fils)}</span>}
          {need && (
            <span className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${need.tone === "warn" ? "text-warn" : "text-muted"}`}>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${need.tone === "warn" ? "bg-warn" : "bg-muted"}`} />
              {lineText(tAll, need.line)}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="sr-only">{t("title")}</h1>
        <label className="relative flex items-center">
          <span className="sr-only">{t("show")}</span>
          <select value={view} onChange={(e) => setView(e.target.value as View)} className="title cursor-pointer appearance-none bg-transparent pe-7 text-3xl [field-sizing:content] sm:text-4xl">
            {views.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <CaretDown size={18} className="pointer-events-none absolute end-0 text-muted" aria-hidden="true" />
        </label>
        <div role="group" aria-label={t("boardOrClosed")} className="inline-flex rounded-full bg-surface-2 p-0.5 text-sm">
          {[false, true].map((c) => (
            <button key={String(c)} type="button" aria-pressed={closed === c} onClick={() => setClosed(c)} className={`min-h-8 rounded-full px-3 font-medium ${closed === c ? "bg-surface text-text shadow-[var(--shadow-1)]" : "text-muted hover:text-text"}`}>
              {c ? t("closedCount", { count: done.length }) : t("open")}
            </button>
          ))}
        </div>
        {canCreate && (
          <button type="button" onClick={() => { setCreating(true); setOpenId(null); }} className={buttonClass("primary", "sm", "ms-auto")}>
            <Plus size={16} aria-hidden="true" /> {t("new")}
          </button>
        )}
      </header>

      {!closed ? (
        <div className="grid items-start gap-4 md:grid-cols-3">
          {OPEN_STAGES.map((stage) => {
            const col = open.filter((d) => d.stage === stage);
            const total = col.reduce((s, d) => s + d.fils, 0);
            return (
              <section
                key={stage}
                aria-label={tAll(`stages.${stage}`)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/plain");
                  const d = deals.find((x) => x.id === id);
                  if (d && canEdit(d)) update(id, { stage });
                  setDragging(null);
                }}
                className={`grid content-start gap-3 rounded-[var(--radius-panel)] bg-surface-2/70 p-3 ${dragging ? "outline-2 outline-dashed outline-border" : ""}`}
              >
                <h2 className="flex items-baseline justify-between gap-2 px-1 text-sm">
                  <span className="font-semibold">{tAll(`stages.${stage}`)} <span className="font-normal text-muted">· {fmt.number(col.length)}</span></span>
                  {allMoney && col.length > 0 && <span className="tabular-nums text-muted">{fmt.aed(total)}</span>}
                </h2>
                {col.length === 0 ? <p className="px-1 pb-2 text-sm text-muted">{t("emptyStage")}</p> : <ul className="grid gap-2">{col.map(card)}</ul>}
              </section>
            );
          })}
        </div>
      ) : done.length === 0 ? (
        <p className="rounded-[var(--radius-panel)] bg-surface p-6 text-muted shadow-[var(--shadow-1)] ring-1 ring-border">{t("emptyClosed")}</p>
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">
          {done.map((d) => (
            <li key={d.id} className="border-b border-border last:border-0">
              <button type="button" onClick={() => setOpenId(d.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-start hover:bg-surface-2">
                <span className="grid min-w-0 flex-1">
                  <bdi className="truncate font-medium">{d.customerName}</bdi>
                  <span className="truncate text-sm text-muted"><bdi>{d.title}</bdi></span>
                </span>
                <Badge tone={STAGE[d.stage][1]}>{tAll(`stages.${d.stage}`)}</Badge>
                <span className="w-28 text-end text-sm tabular-nums">{d.stage === "won" ? (money(d) ? fmt.aed(d.fils) : t("hidden")) : valueLabel(tAll, "lostReason", d.lostReason)}</span>
                <span className="w-24 text-end text-sm text-muted">{d.closedAt ? fmt.ago(d.closedAt, now) : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(selected || creating) && (
        <div className="fixed inset-0 z-40">
          <button type="button" aria-label={t("closeSheet")} onClick={() => { setOpenId(null); setCreating(false); }} className="absolute inset-0 bg-black/25" />
          <aside aria-label={creating ? t("new") : t("deal")} className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col overflow-y-auto bg-surface shadow-[var(--shadow-2)]">
            {creating ? (
              <NewDeal
                onCancel={() => setCreating(false)}
                onCreate={(d) => {
                  const deal: BoardDeal = { ...d, id: `new-${deals.length}`, ownerId: me, teamId: viewer.teamIds[0] ?? teams[0]?.id ?? "", createdAt: now, customerId: null, notes: [] };
                  setDeals([deal, ...deals]);
                  setCreating(false);
                  setOpenId(deal.id);
                }}
              />
            ) : (
              selected && (
                <DealSheet
                  key={selected.id}
                  d={selected}
                  me={me}
                  name={name}
                  team={teams.find((t) => t.id === selected.teamId)?.name ?? ""}
                  money={money(selected)}
                  canEdit={canEdit(selected)}
                  canClose={covers(viewer, "deals.close", ref(selected))}
                  canApprove={covers(viewer, "deals.approve", ref(selected)) && selected.approval?.byId !== me}
                  base={base}
                  now={now}
                  onClose={() => setOpenId(null)}
                  update={(patch) => update(selected.id, patch)}
                />
              )
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function DealSheet(p: {
  d: BoardDeal;
  me: string;
  name: (id: string | null | undefined) => string;
  team: string;
  money: boolean;
  canEdit: boolean;
  canClose: boolean;
  canApprove: boolean;
  base: string;
  now: number;
  onClose: () => void;
  update: (patch: Partial<BoardDeal>) => void;
}) {
  const { d, name, update } = p;
  const [closing, setClosing] = useState<null | "won" | "lost">(null);
  const [finalValue, setFinalValue] = useState((d.fils / 100).toFixed(2));
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState("");
  const isOpen = d.stage !== "won" && d.stage !== "lost";
  const field = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base";
  const discounted = d.approval ? Math.round(d.fils * (1 - d.approval.pct / 100)) : 0;
  const t = useT("deals");
  const tAll = useT();
  const fmt = useFormat();

  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="grid gap-1">
          <p className="text-sm text-muted">
            {d.customerId ? <Link href={`${p.base}/customers/${d.customerId}`} className="underline-offset-2 hover:underline"><bdi>{d.customerName}</bdi></Link> : <bdi>{d.customerName}</bdi>}
          </p>
          <h2 className="text-lg font-semibold"><bdi>{d.title}</bdi></h2>
          <span className="flex items-center gap-2"><Badge tone={STAGE[d.stage][1]}>{tAll(`stages.${d.stage}`)}</Badge>{d.stage === "lost" && d.lostReason && <span className="text-sm text-muted">{t("reason", { reason: valueLabel(tAll, "lostReason", d.lostReason) })}</span>}</span>
        </div>
        <button type="button" onClick={p.onClose} className={buttonClass("ghost", "sm", "!px-2")} aria-label={t("closeSheet")} title={tAll("panel.closeTitle")}><X size={20} aria-hidden="true" /></button>
      </header>

      <div className="grid gap-5 px-5 py-5">
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">{t("value")}</dt>
            <dd>{p.money ? <span className="font-semibold tabular-nums">{fmt.aed(d.fils)}</span> : <span className="text-muted">{t("hiddenForRole")}</span>}</dd>
          </div>
          {isOpen && p.canEdit && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted"><label htmlFor="deal-stage">{t("stage")}</label></dt>
              <dd>
                <select id="deal-stage" value={d.stage} onChange={(e) => update({ stage: e.target.value as OpenStage })} className="min-h-9 rounded-full border border-input bg-surface px-3 text-sm">
                  {OPEN_STAGES.map((s) => <option key={s} value={s}>{tAll(`stages.${s}`)}</option>)}
                </select>
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-3"><dt className="text-muted">{t("owner")}</dt><dd>{name(d.ownerId)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">{t("team")}</dt><dd>{p.team}</dd></div>
          {d.closeDate && <div className="flex justify-between gap-3"><dt className="text-muted">{t("expectedClose")}</dt><dd>{fmt.date(d.closeDate, p.now)}</dd></div>}
          {d.followUp && <div className="flex justify-between gap-3"><dt className="text-muted">{t("followUp")}</dt><dd className="text-end"><bdi>{d.followUp.text}</bdi><span className="block text-muted">{t("followUpWho", { name: name(d.ownerId), when: valueLabel(tAll, "due", d.followUp.due) })}</span></dd></div>}
        </dl>

        {d.approval && (
          <section className={`grid gap-3 rounded-[var(--radius-panel)] p-4 text-sm ${d.approval.status === "pending" ? "bg-warn-soft" : "bg-surface-2"}`}>
            <p className="flex gap-2">
              <WarningCircle size={18} className={`mt-0.5 shrink-0 ${d.approval.status === "pending" ? "text-warn" : "text-muted"}`} aria-hidden="true" />
              <span>
                {p.money
                  ? t.rich("asksValue", {
                      name: <strong className="font-semibold">{name(d.approval.byId)}</strong>,
                      pct: d.approval.pct,
                      from: <span className="tabular-nums">{fmt.aed(d.fils)}</span>,
                      to: <span className="tabular-nums">{fmt.aed(discounted)}</span>,
                    })
                  : t.rich("asks", { name: <strong className="font-semibold">{name(d.approval.byId)}</strong>, pct: d.approval.pct })}
                <span className="mt-1 block text-muted" dir="auto">{t("quote", { text: d.approval.note })}</span>
              </span>
            </p>
            {d.approval.status === "pending" ? (
              p.canApprove ? (
                <div className="grid gap-2">
                  <label className="sr-only" htmlFor="decision-note">{t("noteFor", { name: name(d.approval.byId) })}</label>
                  <input id="decision-note" value={decision} onChange={(e) => setDecision(e.target.value)} placeholder={t("noteForOptional", { name: name(d.approval.byId) })} className={field} />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => update({ approval: { ...d.approval!, status: "declined", decidedById: p.me }, notes: [...d.notes, ...(decision ? [{ byId: p.me, text: decision, at: Date.now() }] : [])] })} className={buttonClass("secondary", "sm")}>{t("decline")}</button>
                    <button type="button" onClick={() => update({ approval: { ...d.approval!, status: "approved", decidedById: p.me }, fils: discounted, notes: [...d.notes, ...(decision ? [{ byId: p.me, text: decision, at: Date.now() }] : [])] })} className={buttonClass("primary", "sm")}>{t("approve", { pct: d.approval.pct })}</button>
                  </div>
                </div>
              ) : (
                <p className="text-muted">{t("waitingApproval")}</p>
              )
            ) : (
              <p className="font-medium">{d.approval.status === "approved" ? t("approvedBy", { name: name(d.approval.decidedById) }) : t("declinedBy", { name: name(d.approval.decidedById) })}</p>
            )}
          </section>
        )}

        <section className="grid gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{t("notes")}</h3>
          {d.notes.length === 0 && <p className="text-sm text-muted">{t("noNotes")}</p>}
          {d.notes.map((n, i) => (
            <p key={i} className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm" dir="auto">{n.text}<span className="block text-xs text-muted">{name(n.byId)} · {fmt.ago(n.at, p.now)}</span></p>
          ))}
          {p.canEdit && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                update({ notes: [...d.notes, { byId: p.me, text: note.trim(), at: Date.now() }] });
                setNote("");
              }}
            >
              <label className="sr-only" htmlFor="deal-note">{t("addNote")}</label>
              <input id="deal-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("addNote")} className={`${field} min-w-0 flex-1 text-sm`} />
              <button type="submit" disabled={!note.trim()} className={buttonClass("secondary", "sm")}>{tAll("common.add")}</button>
            </form>
          )}
        </section>
      </div>

      {isOpen && p.canClose && (
        <footer className="mt-auto grid gap-3 border-t border-border px-5 py-4">
          {closing === "won" ? (
            <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); if (toFils(finalValue) > 0) update({ stage: "won", fils: toFils(finalValue), closedAt: Date.now() }); }}>
              <label htmlFor="final-value" className="text-sm font-medium">{t("finalValue")}</label>
              <input id="final-value" inputMode="decimal" dir="ltr" value={finalValue} onChange={(e) => setFinalValue(e.target.value)} className={field} autoFocus />
              <p className="text-sm text-muted">{t("finalValueHelp")}</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setClosing(null)} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
                <button type="submit" disabled={toFils(finalValue) <= 0} className={buttonClass("primary", "sm")}>{t("markWon")}</button>
              </div>
            </form>
          ) : closing === "lost" ? (
            <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); if (reason) update({ stage: "lost", lostReason: reason, closedAt: Date.now() }); }}>
              <label htmlFor="lost-reason" className="text-sm font-medium">{t("whyLost")}</label>
              <select id="lost-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={field} autoFocus>
                <option value="">{t("chooseReason")}</option>
                {LOST_REASONS.map((r) => <option key={r} value={r}>{valueLabel(tAll, "lostReason", r)}</option>)}
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setClosing(null)} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
                <button type="submit" disabled={!reason} className={buttonClass("destructive", "sm")}>{t("markLost")}</button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setClosing("lost")} className={buttonClass("secondary", "sm")}>{t("markLost")}</button>
              <button type="button" onClick={() => setClosing("won")} className={buttonClass("primary", "sm")}>{t("markWon")}</button>
            </div>
          )}
        </footer>
      )}
    </>
  );
}

function NewDeal({ onCancel, onCreate }: { onCancel: () => void; onCreate: (d: Pick<BoardDeal, "customerName" | "title" | "fils" | "stage">) => void }) {
  const [form, setForm] = useState({ customer: "", title: "", value: "" });
  const [tried, setTried] = useState(false);
  const field = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base";
  const ok = form.customer.trim() && form.title.trim();
  const t = useT("deals");
  const tAll = useT();
  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (ok) onCreate({ customerName: form.customer.trim(), title: form.title.trim(), fils: toFils(form.value), stage: "new" });
      }}
    >
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-lg font-semibold">{t("new")}</h2>
        <button type="button" onClick={onCancel} className={buttonClass("ghost", "sm", "!px-2")} aria-label={tAll("common.close")}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="grid gap-4 px-5 py-5">
        <label className="grid gap-1.5 text-sm font-medium">{t("form.customer")}<input className={field} value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} autoFocus placeholder={t("form.customerPlaceholder")} /></label>
        <label className="grid gap-1.5 text-sm font-medium">{t("form.title")}<input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("form.titlePlaceholder")} /></label>
        <label className="grid gap-1.5 text-sm font-medium">{t("form.value")}<input className={field} inputMode="decimal" dir="ltr" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={tAll("common.optional")} /></label>
        {tried && !ok && <p role="alert" className="text-sm text-fail">{t("form.error")}</p>}
        <p className="text-sm text-muted">{t("form.help")}</p>
      </div>
      <footer className="mt-auto flex justify-end gap-2 border-t border-border px-5 py-4">
        <button type="button" onClick={onCancel} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
        <button type="submit" className={buttonClass("primary", "sm")}>{t("form.submit")}</button>
      </footer>
    </form>
  );
}
