"use client";

import { useState } from "react";
import { Eye, Lock, MagnifyingGlass, ShieldCheck, WarningCircle, X } from "@phosphor-icons/react";
import { RelayLogo } from "@/components/brand/logo";
import { ChannelMark } from "@/components/channels/channel-mark";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { useFormat, useT } from "@/i18n/client";
import { PLATFORM, STAFF_LOG, WORKSPACES, type StaffAction, type StaffWorkspace } from "./sample";

/**
 * Relay's staff console (decided 2026-10-07): every workspace and its health; support access only while the
 * owner has granted it, every use logged; plan, trial and credit changes that require a reason; and platform
 * status. Staff never see a workspace's conversations without that grant.
 */
type Tab = "workspaces" | "platform" | "log";
type Filter = "all" | "trial" | "pastDue" | "broken";
type Act = "extendTrial" | "compCredits" | "changePlan";

export function StaffConsole({ now }: { now: number }) {
  const t = useT("staff");
  const tAll = useT();
  const fmt = useFormat();
  const [tab, setTab] = useState<Tab>("workspaces");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<StaffWorkspace | null>(null);
  const [act, setAct] = useState<Act | null>(null);
  const [amount, setAmount] = useState("7");
  const [reason, setReason] = useState("");
  const [log, setLog] = useState<StaffAction[]>(STAFF_LOG);
  const [requested, setRequested] = useState<string[]>([]);
  const list = WORKSPACES.filter(
    (w) =>
      (!q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase()) || w.owner.toLowerCase().includes(q.trim().toLowerCase())) &&
      (filter === "all" || (filter === "trial" ? w.plan === "trial" : filter === "pastDue" ? w.billing === "pastDue" : w.broken > 0)),
  );
  const mrr = WORKSPACES.reduce((s, w) => s + w.mrr, 0);
  const field = "min-h-10 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm";

  function record(a: StaffAction["action"], detail: string) {
    setLog([{ id: `n${log.length}`, minAgo: 0, staff: t("you"), workspace: open?.name ?? "", action: a, detail, reason: reason.trim() }, ...log]);
  }

  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-3"><RelayLogo size={24} /><span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium">{t("badge")}</span></span>
          <span className="flex items-center gap-1.5 text-xs text-muted"><ShieldCheck size={16} aria-hidden="true" />{t("logged")}</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8">
        <div role="tablist" aria-label={t("badge")} className="flex gap-5 border-b border-border">
          {(["workspaces", "platform", "log"] as const).map((k) => (
            <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px min-h-10 border-b-2 text-sm font-medium ${tab === k ? "border-primary text-text" : "border-transparent text-muted hover:text-text"}`}>{t(`tabs.${k}`)}</button>
          ))}
        </div>

        {tab === "workspaces" && (
          <>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] bg-border ring-1 ring-border md:grid-cols-4">
              {([
                [t("kpi.workspaces"), fmt.number(WORKSPACES.length)],
                [t("kpi.mrr"), fmt.money(mrr)],
                [t("kpi.trials"), fmt.number(WORKSPACES.filter((w) => w.plan === "trial").length)],
                [t("kpi.attention"), fmt.number(WORKSPACES.filter((w) => w.billing === "pastDue" || w.broken > 0).length)],
              ] as const).map(([k, v]) => <div key={k} className="grid gap-1 bg-surface px-5 py-4"><dt className="text-sm text-muted">{k}</dt><dd className="text-2xl font-medium tabular-nums">{v}</dd></div>)}
            </dl>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative w-full sm:w-72">
                <span className="sr-only">{t("search")}</span>
                <MagnifyingGlass size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="min-h-9 w-full rounded-full border border-input bg-surface ps-9 pe-3 text-sm" />
              </label>
              {(["all", "trial", "pastDue", "broken"] as const).map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`min-h-9 rounded-full px-3.5 text-sm ${filter === f ? "bg-primary-soft font-medium text-primary" : "text-muted hover:bg-surface-2"}`}>{t(`filters.${f}`)}</button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-1 ring-border">
              <table className="w-full min-w-[54rem] text-sm">
                <thead><tr className="border-b border-border text-muted">{(["workspace", "plan", "seats", "mrr", "channels", "active", "access"] as const).map((k) => <th key={k} scope="col" className={`px-4 py-3 font-medium ${k === "seats" || k === "mrr" ? "text-end" : "text-start"}`}>{t(`cols.${k}`)}</th>)}</tr></thead>
                <tbody>
                  {list.map((w) => (
                    <tr key={w.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2" onClick={() => { setOpen(w); setAct(null); }}>
                      <td className="px-4 py-3"><button type="button" className="font-medium hover:underline" onClick={() => { setOpen(w); setAct(null); }}>{w.name}</button><span className="block text-xs text-muted">{w.country} · {t("owner", { name: w.owner })}</span></td>
                      <td className="px-4">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={w.plan === "trial" ? "new" : "done"}>{t(`plans.${w.plan}`)}</Badge>
                          {w.billing === "pastDue" && <Badge tone="fail">{t("pastDue")}</Badge>}
                          {w.billing === "cancelled" && <Badge tone="warn">{t("cancelled")}</Badge>}
                          {w.trialDaysLeft !== undefined && <span className="text-xs text-muted">{t("trialLeft", { count: w.trialDaysLeft })}</span>}
                        </span>
                      </td>
                      <td className="px-4 text-end tabular-nums">{w.seats}</td>
                      <td className="px-4 text-end tabular-nums">{fmt.money(w.mrr)}</td>
                      <td className="px-4">
                        <span className="flex items-center gap-1.5">
                          <span className="flex -space-x-1">{w.channels.slice(0, 5).map((c) => <ChannelMark key={c} ch={c} size={18} label={tAll(`channels.${c}`)} className="ring-2 ring-surface" />)}</span>
                          {w.channels.length > 5 && <span className="text-xs text-muted">+{w.channels.length - 5}</span>}
                          {w.broken > 0 && <span className="inline-flex items-center gap-0.5 text-xs text-fail"><WarningCircle size={14} weight="fill" aria-hidden="true" />{w.broken}</span>}
                        </span>
                      </td>
                      <td className="px-4 text-muted">{fmt.ago(now - w.lastActiveMin * 60_000, now)}</td>
                      <td className="px-4">{w.accessMin ? <span className="text-xs text-done">{t("accessFor", { time: fmt.minutesWaited(w.accessMin) })}</span> : <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock size={12} aria-hidden="true" />{t("noAccess")}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "platform" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="grid content-start gap-3 rounded-[var(--radius-panel)] border border-border bg-surface p-5">
              <h2 className="font-semibold">{t("platform.queue")}</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {([
                  [t("platform.queued"), fmt.number(PLATFORM.queue.queued)],
                  [t("platform.oldest"), t("platform.seconds", { count: PLATFORM.queue.oldestSec })],
                  [t("platform.failed"), fmt.number(PLATFORM.queue.failed24h)],
                  [t("platform.dead"), fmt.number(PLATFORM.queue.dead24h)],
                  [t("platform.webhooks"), fmt.number(PLATFORM.webhooks.received24h)],
                  [t("platform.rejected"), fmt.number(PLATFORM.webhooks.rejected24h)],
                ] as const).map(([k, v]) => <div key={k} className="grid"><dt className="text-muted">{k}</dt><dd className="text-lg font-medium tabular-nums">{v}</dd></div>)}
              </dl>
            </section>
            <section className="grid content-start gap-3 rounded-[var(--radius-panel)] border border-border bg-surface p-5">
              <h2 className="font-semibold">{t("platform.providers")}</h2>
              <ul className="grid gap-2 text-sm">
                {PLATFORM.providers.map((p) => (
                  <li key={p.name} className="flex items-start justify-between gap-3">
                    <span className="grid"><span>{p.name}</span>{"note" in p && p.note && <span className="text-xs text-muted">{p.note}</span>}</span>
                    <Badge tone={p.state === "ok" ? "done" : "warn"}>{t(`platform.${p.state}`)}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {tab === "log" && (
          <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface ring-1 ring-border">
            {log.map((l) => (
              <li key={l.id} className="grid gap-0.5 border-b border-border px-5 py-3 text-sm last:border-0">
                <span className="flex flex-wrap justify-between gap-2"><span><span className="font-medium">{l.staff}</span> · {t(`actions.${l.action}`)} · {l.workspace}</span><span className="text-xs text-muted">{l.minAgo === 0 ? t("justNow") : fmt.ago(now - l.minAgo * 60_000, now)}</span></span>
                <span>{l.detail}</span>
                <span className="text-muted">{t("reasonLabel")}: {l.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </main>

      {open && (
        <div className="fixed inset-0 z-40">
          <button type="button" aria-label={t("close")} onClick={() => setOpen(null)} className="absolute inset-0 bg-black/40" />
          <aside role="dialog" aria-modal="true" aria-label={open.name} className="absolute inset-y-0 end-0 grid w-full max-w-md content-start gap-5 overflow-y-auto bg-surface p-6 shadow-[var(--shadow-2)]">
            <header className="flex items-start justify-between gap-3">
              <div className="grid"><h2 className="title text-2xl">{open.name}</h2><p className="text-sm text-muted">{open.country} · {t("owner", { name: open.owner })}</p></div>
              <button type="button" onClick={() => setOpen(null)} aria-label={t("close")} className={buttonClass("ghost", "sm", "!px-2")}><X size={18} aria-hidden="true" /></button>
            </header>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted">{t("cols.plan")}</dt><dd>{t(`plans.${open.plan}`)} · {t("seatsN", { count: open.seats })}</dd></div>
              <div><dt className="text-muted">{t("cols.mrr")}</dt><dd className="tabular-nums">{fmt.money(open.mrr)}</dd></div>
              <div><dt className="text-muted">{t("conversations30d")}</dt><dd className="tabular-nums">{fmt.number(open.conversations30d)}</dd></div>
              <div><dt className="text-muted">{t("brokenChannels")}</dt><dd className={open.broken ? "text-fail" : ""}>{open.broken}</dd></div>
            </dl>

            <section className="grid gap-2 rounded-[var(--radius-control)] border border-border p-4 text-sm">
              <h3 className="font-semibold">{t("supportAccess")}</h3>
              {open.accessMin ? (
                <>
                  <p>{t("accessGranted", { owner: open.owner, time: fmt.minutesWaited(open.accessMin) })}</p>
                  <button type="button" onClick={() => { record("accessUsed", t("openedReadOnly")); }} className={buttonClass("secondary", "sm", "w-fit")}><Eye size={16} aria-hidden="true" /> {t("openReadOnly")}</button>
                </>
              ) : requested.includes(open.id) ? (
                <p className="text-muted">{t("requestSent", { owner: open.owner })}</p>
              ) : (
                <>
                  <p className="text-muted">{t("accessHelp")}</p>
                  <button type="button" onClick={() => { setRequested([...requested, open.id]); setLog([{ id: `n${log.length}`, minAgo: 0, staff: t("you"), workspace: open.name, action: "accessRequested", detail: t("askedOwner", { owner: open.owner }), reason: t("supportTicket") }, ...log]); }} className={buttonClass("secondary", "sm", "w-fit")}>
                    <Lock size={16} aria-hidden="true" /> {t("requestAccess")}
                  </button>
                </>
              )}
            </section>

            <section className="grid gap-3 text-sm">
              <h3 className="font-semibold">{t("changes")}</h3>
              <div className="flex flex-wrap gap-2">
                {(["extendTrial", "compCredits", "changePlan"] as const).map((a) => (
                  <button key={a} type="button" aria-pressed={act === a} onClick={() => { setAct(a); setReason(""); setAmount(a === "extendTrial" ? "7" : a === "compCredits" ? "500" : "growth"); }} className={buttonClass(act === a ? "secondary" : "ghost", "sm")}>{t(`actions.${a}`)}</button>
                ))}
              </div>
              {act && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (reason.trim().length < 10) return;
                    record(act, act === "extendTrial" ? t("trialPlus", { count: Number(amount) }) : act === "compCredits" ? t("creditsPlus", { count: fmt.number(Number(amount)) }) : `${t(`plans.${open.plan}`)} → ${t(`plans.${amount as "growth"}`)}`);
                    setAct(null);
                  }}
                  className="grid gap-3 rounded-[var(--radius-control)] bg-surface-2 p-4"
                >
                  {act === "changePlan" ? (
                    <select value={amount} onChange={(e) => setAmount(e.target.value)} className={field} aria-label={t("cols.plan")}>
                      {(["starter", "growth", "pro"] as const).map((p) => <option key={p} value={p}>{t(`plans.${p}`)}</option>)}
                    </select>
                  ) : (
                    <label className="grid gap-1">{act === "extendTrial" ? t("days") : t("credits")}<input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${field} w-32`} /></label>
                  )}
                  <label className="grid gap-1">{t("reasonLabel")}<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="rounded-[var(--radius-control)] border border-input bg-surface p-2" placeholder={t("reasonPlaceholder")} /></label>
                  {reason.trim().length > 0 && reason.trim().length < 10 && <p role="alert" className="text-fail">{t("reasonShort")}</p>}
                  <button type="submit" disabled={reason.trim().length < 10 || !amount} className={buttonClass("primary", "sm", "w-fit")}>{t("apply")}</button>
                </form>
              )}
            </section>

            <section className="grid gap-2 text-sm">
              <h3 className="font-semibold">{t("history")}</h3>
              <ul className="grid gap-2">
                {log.filter((l) => l.workspace === open.name).map((l) => <li key={l.id} className="text-muted"><span className="text-text">{t(`actions.${l.action}`)}</span> · {l.detail} · {l.staff}</li>)}
                {log.every((l) => l.workspace !== open.name) && <li className="text-muted">{t("noHistory")}</li>}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
