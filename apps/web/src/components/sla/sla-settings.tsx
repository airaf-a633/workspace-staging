"use client";

import { useState } from "react";
import { Info, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { ChannelMark } from "@/components/channels/channel-mark";
import { CHANNELS, type ChannelKey } from "@/components/channels/catalog";
import { useFormat, useT } from "@/i18n/client";
import type { SlaPolicy, SlaSettings, Target, WeekHours } from "./sla";

/**
 * Settings › Reply targets (decided 2026-10-07): business hours in the workspace zone, policies matched by team,
 * channel and VIP (the strictest target wins), and who is alerted. Editing needs teams.manage for everything.
 */
const TARGETS: Target[] = ["firstReply", "nextReply", "resolution"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Minutes as an hours-or-minutes pair for the form, and back. */
const split = (m: number | null) => (m === null ? { n: "", unit: "min" as const } : m % 60 === 0 && m >= 60 ? { n: String(m / 60), unit: "h" as const } : { n: String(m), unit: "min" as const });

function PolicyForm({ initial, teams, onSave, onCancel }: { initial: SlaPolicy; teams: { id: string; name: string }[]; onSave: (p: SlaPolicy) => void; onCancel: () => void }) {
  const t = useT("slaSettings");
  const tAll = useT();
  const [p, setP] = useState(initial);
  const [times, setTimes] = useState(() => Object.fromEntries(TARGETS.map((k) => [k, split(initial[k])])) as Record<Target, { n: string; unit: "min" | "h" }>);
  const field = "min-h-10 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm";
  const toMinutes = (k: Target) => (times[k].n.trim() === "" ? null : Math.round(Number(times[k].n) * (times[k].unit === "h" ? 60 : 1)));
  const invalid = TARGETS.some((k) => times[k].n.trim() !== "" && !(Number(times[k].n) > 0));
  const empty = TARGETS.every((k) => times[k].n.trim() === "");
  const toggleIn = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!p.name.trim() || invalid || empty) return;
        onSave({ ...p, name: p.name.trim(), firstReply: toMinutes("firstReply"), nextReply: toMinutes("nextReply"), resolution: toMinutes("resolution") });
      }}
      className="grid gap-4 rounded-[var(--radius-control)] border border-primary/40 bg-surface p-4"
    >
      <label className="grid gap-1 text-sm font-medium">
        {t("name")}
        <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} maxLength={50} className={field} autoFocus />
      </label>
      <fieldset className="grid gap-2">
        <legend className="pb-1 text-sm font-medium">{t("appliesTo")}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!p.match.vip} onChange={(e) => setP({ ...p, match: { ...p.match, vip: e.target.checked || undefined } })} className="size-4 accent-[var(--primary)]" />
          {t("vipOnly")}
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("teams")}>
          {teams.map((x) => (
            <button key={x.id} type="button" aria-pressed={!!p.match.teams?.includes(x.id)} onClick={() => setP({ ...p, match: { ...p.match, teams: toggleIn(p.match.teams, x.id) } })} className={`min-h-8 rounded-full border px-3 text-xs ${p.match.teams?.includes(x.id) ? "border-primary bg-primary-soft text-primary" : "border-border text-muted"}`}>{x.name}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("channels")}>
          {CHANNELS.filter((c) => c.key !== "voice" && c.key !== "api").map((c) => (
            <button key={c.key} type="button" aria-pressed={!!p.match.channels?.includes(c.key)} onClick={() => setP({ ...p, match: { ...p.match, channels: toggleIn<ChannelKey>(p.match.channels, c.key) } })} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs ${p.match.channels?.includes(c.key) ? "border-primary bg-primary-soft text-primary" : "border-border text-muted"}`}>
              <ChannelMark ch={c.key} size={14} label={false} />{tAll(`channels.${c.key}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{t("matchHelp")}</p>
      </fieldset>
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="pb-1 text-sm font-medium">{t("targetsTitle")}</legend>
        {TARGETS.map((k) => (
          <label key={k} className="grid gap-1 text-sm">
            {t(`targets.${k}`)}
            <span className="flex gap-1">
              <input inputMode="numeric" value={times[k].n} onChange={(e) => setTimes({ ...times, [k]: { ...times[k], n: e.target.value } })} placeholder="—" className={`${field} w-20`} />
              <select value={times[k].unit} onChange={(e) => setTimes({ ...times, [k]: { ...times[k], unit: e.target.value as "min" | "h" } })} className={field} aria-label={t("unit")}>
                <option value="min">{t("minutesUnit")}</option>
                <option value="h">{t("hoursUnit")}</option>
              </select>
            </span>
          </label>
        ))}
      </fieldset>
      {(invalid || empty) && <p role="alert" className="text-sm text-fail">{invalid ? t("invalid") : t("emptyTargets")}</p>}
      <span className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
        <button type="submit" disabled={!p.name.trim() || invalid || empty} className={buttonClass("primary", "sm")}>{t("save")}</button>
      </span>
    </form>
  );
}

export function SlaSettingsPage({ initial, teams, canEdit }: { initial: SlaSettings; teams: { id: string; name: string }[]; canEdit: boolean }) {
  const t = useT("slaSettings");
  const tAll = useT();
  const fmt = useFormat();
  const [s, setS] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const card = "grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6";
  const field = "min-h-9 rounded-[var(--radius-control)] border border-input bg-surface px-2 text-sm disabled:opacity-60";
  const teamName = (id: string) => teams.find((x) => x.id === id)?.name ?? id;
  const setHours = (d: number, v: [string, string] | null) => setS({ ...s, hours: s.hours.map((h, i) => (i === d ? v : h)) as WeekHours });
  const describe = (p: SlaPolicy) =>
    [p.match.vip ? t("vip") : null, ...(p.match.teams ?? []).map(teamName), ...(p.match.channels ?? []).map((c) => tAll(`channels.${c}`))].filter(Boolean).join(", ") || t("everything");

  return (
    <div className="grid gap-6">
      {note && <p role="status" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-done-soft px-4 py-2 text-sm"><Info size={16} aria-hidden="true" />{note}</p>}

      <section className={card} aria-labelledby="sla-policies">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 id="sla-policies" className="text-base font-semibold">{t("policies")}</h2>
            <p className="text-sm text-muted">{t("policiesHelp")}</p>
          </div>
          {canEdit && !editing && (
            <button type="button" onClick={() => { const id = `p-new-${s.policies.length}`; setS({ ...s, policies: [...s.policies, { id, name: "", active: true, match: {}, firstReply: 60, nextReply: null, resolution: null }] }); setEditing(id); }} className={buttonClass("secondary", "sm")}>
              <Plus size={16} aria-hidden="true" /> {t("add")}
            </button>
          )}
        </div>
        <ul className="grid gap-2">
          {s.policies.map((p) =>
            editing === p.id ? (
              <li key={p.id}>
                <PolicyForm
                  initial={p}
                  teams={teams}
                  onCancel={() => { setEditing(null); if (!p.name) setS({ ...s, policies: s.policies.filter((x) => x.id !== p.id) }); }}
                  onSave={(np) => { setS({ ...s, policies: s.policies.map((x) => (x.id === p.id ? np : x)) }); setEditing(null); setNote(t("saved")); }}
                />
              </li>
            ) : (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-border px-4 py-3 ${p.active ? "" : "opacity-60"}`}>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">{p.name}</span>
                  <span className="truncate text-xs text-muted">{describe(p)}</span>
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted">
                  {TARGETS.map((k) => p[k] !== null && <span key={k}>{t(`targetsShort.${k}`)} <span className="text-text">{fmt.minutesWaited(p[k]!)}</span></span>)}
                </span>
                {canEdit && (
                  <span className="flex items-center gap-1">
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" role="switch" checked={p.active} onChange={(e) => setS({ ...s, policies: s.policies.map((x) => (x.id === p.id ? { ...x, active: e.target.checked } : x)) })} className="size-4 accent-[var(--primary)]" />
                      {t("on")}
                    </label>
                    <button type="button" onClick={() => setEditing(p.id)} className={buttonClass("ghost", "sm", "!px-2")} aria-label={t("edit", { name: p.name })}><PencilSimple size={16} aria-hidden="true" /></button>
                    <button type="button" onClick={() => setS({ ...s, policies: s.policies.filter((x) => x.id !== p.id) })} className={buttonClass("ghost", "sm", "!px-2")} aria-label={t("remove", { name: p.name })}><Trash size={16} aria-hidden="true" /></button>
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
        <p className="text-xs text-muted">{t("conflict")}</p>
      </section>

      <section className={card} aria-labelledby="sla-hours">
        <div className="grid gap-1">
          <h2 id="sla-hours" className="text-base font-semibold">{t("hours")}</h2>
          <p className="text-sm text-muted">{t("hoursHelp", { zone: s.tz.replaceAll("_", " ") })}</p>
        </div>
        <ul className="grid gap-2">
          {s.hours.map((h, d) => (
            <li key={DAYS[d]} className="grid grid-cols-[6rem_auto_1fr] items-center gap-3 text-sm">
              <span>{tAll(`reports.days.${DAYS[d]}`)}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={!!h} disabled={!canEdit} onChange={(e) => setHours(d, e.target.checked ? ["09:00", "17:00"] : null)} className="size-4 accent-[var(--primary)]" />
                {t("open")}
              </label>
              {h ? (
                <span className="flex items-center gap-2">
                  <input type="time" value={h[0]} disabled={!canEdit} onChange={(e) => setHours(d, [e.target.value, h[1]])} className={field} aria-label={t("from")} />
                  <span className="text-muted">–</span>
                  <input type="time" value={h[1]} disabled={!canEdit} onChange={(e) => setHours(d, [h[0], e.target.value])} className={field} aria-label={t("to")} />
                  {h[1] <= h[0] && <span role="alert" className="text-xs text-fail">{t("closeAfterOpen")}</span>}
                </span>
              ) : <span className="text-muted">{t("closed")}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className={card} aria-labelledby="sla-alerts">
        <h2 id="sla-alerts" className="text-base font-semibold">{t("alerts")}</h2>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>{t("warnAt")}</span>
          <select value={s.warnAt} disabled={!canEdit} onChange={(e) => setS({ ...s, warnAt: Number(e.target.value) })} className={field}>
            {[0.5, 0.75, 0.8, 0.9].map((v) => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}
          </select>
        </label>
        <label className="flex items-start justify-between gap-4 text-sm">
          <span className="grid"><span>{t("alertManager")}</span><span className="text-xs text-muted">{t("alertManagerHelp")}</span></span>
          <input type="checkbox" role="switch" checked={s.alertManager} disabled={!canEdit} onChange={(e) => setS({ ...s, alertManager: e.target.checked })} className="mt-0.5 size-5 accent-[var(--primary)]" />
        </label>
        <label className="flex items-start justify-between gap-4 text-sm">
          <span className="grid"><span>{t("reassign")}</span><span className="text-xs text-muted">{t("reassignHelp")}</span></span>
          <input type="checkbox" role="switch" checked={s.reassignOnBreach} disabled={!canEdit} onChange={(e) => setS({ ...s, reassignOnBreach: e.target.checked })} className="mt-0.5 size-5 accent-[var(--primary)]" />
        </label>
        {!canEdit && <p className="text-sm text-muted">{t("readOnly")}</p>}
      </section>
    </div>
  );
}
