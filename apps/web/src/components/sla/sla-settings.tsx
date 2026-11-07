"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info, PencilSimple, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { ChannelMark } from "@/components/channels/channel-mark";
import { CHANNELS, type ChannelKey } from "@/components/channels/catalog";
import { useFormat, useLocale, useT } from "@/i18n/client";
import type { PolicyInput, Result } from "@/app/w/[slug]/sla/actions";
import type { Closure, SlaPolicy, SlaSettings, Target, WeekHours } from "./sla";

/**
 * Settings › Reply targets (decided 2026-10-07; hours per team and the rest settled 2026-11-03): rules matched by team, channel and
 * VIP (the strictest target wins), each team's opening hours and closed days, and who is alerted. Editing needs teams.manage: everything
 * for the owner, only their own teams (and rules that name only those teams) for a team manager.
 * In the preview nothing is stored (`actions` is absent); in a real workspace each change is one database function and the page reloads.
 */
const TARGETS: Target[] = ["firstReply", "nextReply", "resolution"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const ALL_DAY: [string, string] = ["00:00", "24:00"];

export interface SlaActions {
  saveHours: (teamId: string, week: WeekHours) => Promise<Result>;
  addClosure: (teamId: string, input: { from: string; to: string; hours: [string, string] | null; label: string }) => Promise<Result>;
  removeClosure: (id: string) => Promise<Result>;
  savePolicy: (p: PolicyInput) => Promise<Result>;
  deletePolicy: (id: string) => Promise<Result>;
  saveAlerts: (warnAt: number, alertManager: boolean) => Promise<Result>;
}

export interface Editable {
  /** May change every team's hours, every rule, and the alert settings. */
  all: boolean;
  /** Teams whose hours (and rules that name only these teams) the person may change. */
  teams: string[];
}

/** Minutes as an hours-or-minutes pair for the form, and back. */
const split = (m: number | null) => (m === null ? { n: "", unit: "min" as const } : m % 60 === 0 && m >= 60 ? { n: String(m / 60), unit: "h" as const } : { n: String(m), unit: "min" as const });
const sameWeek = (a: WeekHours, b: WeekHours) => JSON.stringify(a) === JSON.stringify(b);
const isAllDay = (h: [string, string] | null) => !!h && h[0] === ALL_DAY[0] && h[1] === ALL_DAY[1];

function PolicyForm({ initial, teams, mustPickTeam, onSave, onCancel }: { initial: SlaPolicy; teams: { id: string; name: string }[]; mustPickTeam: boolean; onSave: (p: SlaPolicy) => void; onCancel: () => void }) {
  const t = useT("slaSettings");
  const tAll = useT();
  const [p, setP] = useState(initial);
  const [times, setTimes] = useState(() => Object.fromEntries(TARGETS.map((k) => [k, split(initial[k])])) as Record<Target, { n: string; unit: "min" | "h" }>);
  const field = "min-h-10 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm";
  const toMinutes = (k: Target) => (times[k].n.trim() === "" ? null : Math.round(Number(times[k].n) * (times[k].unit === "h" ? 60 : 1)));
  const invalid = TARGETS.some((k) => times[k].n.trim() !== "" && !(Number(times[k].n) > 0));
  const empty = TARGETS.every((k) => times[k].n.trim() === "");
  const noTeam = mustPickTeam && !p.match.teams?.length;
  const toggleIn = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!p.name.trim() || invalid || empty || noTeam) return;
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
        <p className="text-xs text-muted">{mustPickTeam ? t("matchHelpTeam") : t("matchHelp")}</p>
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
      {(invalid || empty || noTeam) && <p role="alert" className="text-sm text-fail">{noTeam ? t("needTeam") : invalid ? t("invalid") : t("emptyTargets")}</p>}
      <span className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
        <button type="submit" disabled={!p.name.trim() || invalid || empty || noTeam} className={buttonClass("primary", "sm")}>{t("save")}</button>
      </span>
    </form>
  );
}

/** Add a closed day, or a day with its own hours, to one team. */
function ClosureForm({ onAdd, onCancel }: { onAdd: (c: Omit<Closure, "id">) => void; onCancel: () => void }) {
  const t = useT("slaSettings");
  const tAll = useT();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<"closed" | "hours">("closed");
  const [hours, setHours] = useState<[string, string]>(["10:00", "14:00"]);
  const [label, setLabel] = useState("");
  const field = "min-h-10 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm";
  const last = to || from;
  const badDates = !!from && !!last && last < from;
  const badHours = kind === "hours" && hours[1] <= hours[0];
  const ready = !!from && !badDates && !badHours;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onAdd({ from, to: last, hours: kind === "closed" ? null : hours, label: label.trim() });
      }}
      className="grid gap-3 rounded-[var(--radius-control)] border border-primary/40 bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">{t("firstDay")}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} autoFocus /></label>
        <label className="grid gap-1 text-sm font-medium">{t("lastDay")}<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={field} /></label>
      </div>
      <fieldset className="grid gap-2">
        <legend className="pb-1 text-sm font-medium">{t("kind")}</legend>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="closure-kind" checked={kind === "closed"} onChange={() => setKind("closed")} className="size-4 accent-[var(--primary)]" />{t("kindClosed")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="closure-kind" checked={kind === "hours"} onChange={() => setKind("hours")} className="size-4 accent-[var(--primary)]" />{t("kindHours")}</label>
        {kind === "hours" && (
          <span className="flex items-center gap-2 ps-6">
            <input type="time" value={hours[0]} onChange={(e) => setHours([e.target.value, hours[1]])} className={field} aria-label={t("from")} />
            <span className="text-muted">–</span>
            <input type="time" value={hours[1]} onChange={(e) => setHours([hours[0], e.target.value])} className={field} aria-label={t("to")} />
          </span>
        )}
      </fieldset>
      <label className="grid gap-1 text-sm font-medium">{t("closedName")}<input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className={field} /></label>
      {(badDates || badHours) && <p role="alert" className="text-sm text-fail">{badDates ? t("errors.badDates") : t("errors.badHours")}</p>}
      <span className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
        <button type="submit" disabled={!ready} className={buttonClass("primary", "sm")}>{t("closedAdd")}</button>
      </span>
    </form>
  );
}

export function SlaSettingsPage({ initial, teams, editable, actions }: { initial: SlaSettings; teams: { id: string; name: string }[]; editable: Editable; actions?: SlaActions }) {
  const t = useT("slaSettings");
  const tAll = useT();
  const fmt = useFormat();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [s, setS] = useState(initial);
  // In a real workspace, changed data from the server (after a save) replaces what is on screen. Identical data (a refresh for
  // another reason, such as a new notice or the time-zone check) leaves what the person is typing alone.
  const key = JSON.stringify(initial);
  const [seen, setSeen] = useState(key);
  const [drafts, setDrafts] = useState<Record<string, WeekHours>>({});
  if (actions && key !== seen) {
    setSeen(key);
    setS(initial);
    setDrafts({});
  }
  const [editing, setEditing] = useState<string | null>(null);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [addingClosure, setAddingClosure] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const card = "grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6";
  const field = "min-h-9 rounded-[var(--radius-control)] border border-input bg-surface px-2 text-sm disabled:opacity-60";
  const teamName = (id: string) => teams.find((x) => x.id === id)?.name ?? id;
  const canTeam = (id: string) => editable.all || editable.teams.includes(id);
  const canPolicy = (p: SlaPolicy) => editable.all || (!!p.match.teams?.length && p.match.teams.every((id) => editable.teams.includes(id)));
  const canAdd = editable.all || editable.teams.length > 0;
  const pickable = editable.all ? teams : teams.filter((x) => editable.teams.includes(x.id));
  const describe = (p: SlaPolicy) =>
    [p.match.vip ? t("vip") : null, ...(p.match.teams ?? []).map(teamName), ...(p.match.channels ?? []).map((c) => tAll(`channels.${c}`))].filter(Boolean).join(", ") || t("everything");
  const dayFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const showDay = (iso: string) => dayFmt.format(Date.parse(`${iso}T12:00:00Z`));

  /** Runs a change: in a real workspace the database function, then a reload; in the preview only this page changes. */
  function apply(call: (() => Promise<Result>) | null, local: () => void, message: string) {
    setError(null);
    if (!actions || !call) {
      local();
      setNote(message);
      return;
    }
    startTransition(async () => {
      const r = await call();
      if (r.ok) {
        setNote(message);
        router.refresh();
      } else {
        setNote(null);
        setError(t(`errors.${r.error}`));
      }
    });
  }

  /** "A customer here gets an answer within 15 min, another reply within 30 min, and it's finished within 8 h." */
  const sentence = (p: SlaPolicy) => {
    const parts = TARGETS.filter((k) => p[k] !== null).map((k) => t(`sentence.${k}`, { time: fmt.minutesWaited(p[k]!) }));
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")}${t("sentence.and")}${parts.at(-1)}` : parts[0] ?? "";
    return t("sentence.lead", { list });
  };

  const input = (p: SlaPolicy): PolicyInput => ({
    id: p.id.startsWith("p-new") ? null : p.id,
    name: p.name,
    active: p.active,
    teams: p.match.teams ?? [],
    channels: p.match.channels ?? [],
    vip: !!p.match.vip,
    firstReply: p.firstReply,
    nextReply: p.nextReply,
    resolution: p.resolution,
  });
  const savePolicy = (p: SlaPolicy, isNew: boolean) =>
    apply(
      actions ? () => actions.savePolicy(input(p)) : null,
      () => setS((cur) => ({ ...cur, policies: isNew ? [...cur.policies, { ...p, id: `p-new-${cur.policies.length}-${p.name}` }] : cur.policies.map((x) => (x.id === p.id ? p : x)) })),
      actions ? t("savedLive") : t("saved"),
    );

  const schedule = s.schedules[teamId];
  const week = drafts[teamId] ?? schedule?.week ?? [];
  const setDay = (d: number, v: [string, string] | null) => setDrafts({ ...drafts, [teamId]: week.map((h, i) => (i === d ? v : h)) as WeekHours });
  const dirty = !!schedule && !sameWeek(week, schedule.week);
  const mayEditHours = canTeam(teamId);
  const badHours = week.some((h) => h && h[1] !== "24:00" && h[1] <= h[0]);

  return (
    <div className="grid gap-6">
      {note && <p role="status" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-done-soft px-4 py-2 text-sm"><Info size={16} aria-hidden="true" />{note}</p>}
      {error && <p role="alert" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-fail-soft px-4 py-2 text-sm"><WarningCircle size={16} aria-hidden="true" />{error}</p>}

      <section className={card} aria-labelledby="sla-policies">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 id="sla-policies" className="text-base font-semibold">{t("policies")}</h2>
            <p className="text-sm text-muted">{t("policiesHelp")}</p>
          </div>
          {canAdd && !editing && (
            <button type="button" onClick={() => setEditing("new")} className={buttonClass("secondary", "sm")}>
              <Plus size={16} aria-hidden="true" /> {t("add")}
            </button>
          )}
        </div>
        <ul className="grid gap-2">
          {editing === "new" && (
            <li>
              <PolicyForm
                initial={{ id: "p-new", name: "", active: true, match: {}, firstReply: 60, nextReply: null, resolution: null }}
                teams={pickable}
                mustPickTeam={!editable.all}
                onCancel={() => setEditing(null)}
                onSave={(np) => { savePolicy(np, true); setEditing(null); }}
              />
            </li>
          )}
          {s.policies.map((p) =>
            editing === p.id ? (
              <li key={p.id}>
                <PolicyForm initial={p} teams={pickable} mustPickTeam={!editable.all} onCancel={() => setEditing(null)} onSave={(np) => { savePolicy(np, false); setEditing(null); }} />
              </li>
            ) : (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-border px-4 py-3 ${p.active ? "" : "bg-surface-2"}`}>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">{p.name}</span>
                  <span className="truncate text-xs text-muted">{describe(p)}</span>
                  {/* Each rule in one plain sentence (simplicity pass 2026-10-19). */}
                  <span className="text-sm">{sentence(p)}</span>
                </span>
                {canPolicy(p) && (
                  <span className="flex items-center gap-1">
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" role="switch" checked={p.active} disabled={pending} onChange={(e) => savePolicy({ ...p, active: e.target.checked }, false)} className="size-4 accent-[var(--primary)]" />
                      {t("on")}
                    </label>
                    <button type="button" onClick={() => setEditing(p.id)} className={buttonClass("ghost", "sm", "!px-2")} aria-label={t("edit", { name: p.name })}><PencilSimple size={16} aria-hidden="true" /></button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => apply(actions ? () => actions.deletePolicy(p.id) : null, () => setS((cur) => ({ ...cur, policies: cur.policies.filter((x) => x.id !== p.id) })), actions ? t("savedLive") : t("saved"))}
                      className={buttonClass("ghost", "sm", "!px-2")}
                      aria-label={t("remove", { name: p.name })}
                    ><Trash size={16} aria-hidden="true" /></button>
                  </span>
                )}
              </li>
            ),
          )}
          {s.policies.length === 0 && editing !== "new" && <li className="text-sm text-muted">{t("noRules")}</li>}
        </ul>
        <p className="text-xs text-muted">{t("conflict")}</p>
      </section>

      <section className={card} aria-labelledby="sla-hours">
        <div className="grid gap-1">
          <h2 id="sla-hours" className="text-base font-semibold">{t("hours")}</h2>
          <p className="text-sm text-muted">{t("hoursHelp", { zone: s.tz.replaceAll("_", " ") })}</p>
        </div>
        {teams.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("team")}>
            {teams.map((x) => (
              <button key={x.id} type="button" aria-pressed={x.id === teamId} onClick={() => { setTeamId(x.id); setAddingClosure(false); }} className={`min-h-9 rounded-full border px-3.5 text-sm ${x.id === teamId ? "border-primary bg-primary-soft font-medium text-primary" : "border-border text-muted"}`}>{x.name}</button>
            ))}
          </div>
        )}
        {schedule && (
          <>
            <ul className="grid gap-2">
              {week.map((h, d) => (
                <li key={DAYS[d]} className="grid grid-cols-[4rem_auto_1fr] items-center gap-3 text-sm sm:grid-cols-[6rem_auto_1fr]">
                  <span>{tAll(`reports.days.${DAYS[d]}`)}</span>
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" checked={!!h} disabled={!mayEditHours} onChange={(e) => setDay(d, e.target.checked ? ["09:00", "17:00"] : null)} className="size-4 accent-[var(--primary)]" />
                    {t("open")}
                  </label>
                  {h ? (
                    <span className="flex flex-wrap items-center gap-2">
                      {isAllDay(h) ? (
                        <span className="text-muted">00:00 – 24:00</span>
                      ) : (
                        <>
                          <input type="time" value={h[0]} disabled={!mayEditHours} onChange={(e) => setDay(d, [e.target.value, h[1]])} className={field} aria-label={t("from")} />
                          <span className="text-muted">–</span>
                          <input type="time" value={h[1] === "24:00" ? "23:59" : h[1]} disabled={!mayEditHours} onChange={(e) => setDay(d, [h[0], e.target.value])} className={field} aria-label={t("to")} />
                        </>
                      )}
                      {mayEditHours && (
                        <label className="flex items-center gap-1.5 text-xs text-muted">
                          <input type="checkbox" checked={isAllDay(h)} onChange={(e) => setDay(d, e.target.checked ? ALL_DAY : ["09:00", "17:00"])} className="size-4 accent-[var(--primary)]" />
                          {t("allDay")}
                        </label>
                      )}
                      {h[1] !== "24:00" && h[1] <= h[0] && <span role="alert" className="text-xs text-fail">{t("closeAfterOpen")}</span>}
                    </span>
                  ) : <span className="text-muted">{t("closed")}</span>}
                </li>
              ))}
            </ul>
            {mayEditHours ? (
              <span className="flex justify-end">
                <button
                  type="button"
                  disabled={!dirty || badHours || pending}
                  onClick={() => apply(actions ? () => actions.saveHours(teamId, week) : null, () => setS((cur) => ({ ...cur, schedules: { ...cur.schedules, [teamId]: { ...cur.schedules[teamId], week } } })), actions ? t("hoursSaved") : t("saved"))}
                  className={buttonClass("primary", "sm")}
                >{t("saveHours")}</button>
              </span>
            ) : (
              <p className="text-sm text-muted">{t("hoursReadOnly")}</p>
            )}

            <div className="grid gap-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <h3 className="text-sm font-semibold">{t("closedDays")}</h3>
                  <p className="text-sm text-muted">{t("closedDaysHelp")}</p>
                </div>
                {mayEditHours && !addingClosure && (
                  <button type="button" onClick={() => setAddingClosure(true)} className={buttonClass("secondary", "sm")}><Plus size={16} aria-hidden="true" /> {t("addClosed")}</button>
                )}
              </div>
              {addingClosure && (
                <ClosureForm
                  onCancel={() => setAddingClosure(false)}
                  onAdd={(c) => {
                    apply(
                      actions ? () => actions.addClosure(teamId, c) : null,
                      () => setS((cur) => ({ ...cur, schedules: { ...cur.schedules, [teamId]: { ...cur.schedules[teamId], closures: [...cur.schedules[teamId].closures, { ...c, id: `c-new-${cur.schedules[teamId].closures.length}` }].sort((a, b) => a.from.localeCompare(b.from)) } } })),
                      actions ? t("savedLive") : t("saved"),
                    );
                    setAddingClosure(false);
                  }}
                />
              )}
              <ul className="grid gap-2">
                {schedule.closures.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border px-4 py-2.5 text-sm">
                    <span className="grid gap-0.5">
                      <span className="font-medium">{c.label || (c.from === c.to ? t("when.one", { day: showDay(c.from) }) : t("when.range", { from: showDay(c.from), to: showDay(c.to) }))}</span>
                      <span className="text-xs text-muted">
                        {c.label ? `${c.from === c.to ? t("when.one", { day: showDay(c.from) }) : t("when.range", { from: showDay(c.from), to: showDay(c.to) })} · ` : ""}
                        {c.hours ? t("whatHours", { from: c.hours[0], to: c.hours[1] }) : t("whatClosed")}
                      </span>
                    </span>
                    {mayEditHours && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => apply(actions ? () => actions.removeClosure(c.id) : null, () => setS((cur) => ({ ...cur, schedules: { ...cur.schedules, [teamId]: { ...cur.schedules[teamId], closures: cur.schedules[teamId].closures.filter((x) => x.id !== c.id) } } })), actions ? t("savedLive") : t("saved"))}
                        className={buttonClass("ghost", "sm", "!px-2")}
                        aria-label={t("closedRemove", { label: c.label || showDay(c.from) })}
                      ><Trash size={16} aria-hidden="true" /></button>
                    )}
                  </li>
                ))}
                {schedule.closures.length === 0 && !addingClosure && <li className="text-sm text-muted">{t("noClosedDays")}</li>}
              </ul>
            </div>
          </>
        )}
      </section>

      <section className={card} aria-labelledby="sla-alerts">
        <h2 id="sla-alerts" className="text-base font-semibold">{t("alerts")}</h2>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>{t("warnAt")}</span>
          <select
            value={s.warnAt}
            disabled={!editable.all || pending}
            onChange={(e) => { const v = Number(e.target.value); apply(actions ? () => actions.saveAlerts(v, s.alertManager) : null, () => setS((cur) => ({ ...cur, warnAt: v })), actions ? t("savedLive") : t("saved")); }}
            className={field}
          >
            {([[0.5, "half"], [0.8, "close"], [0.9, "last"]] as const).map(([v, k]) => <option key={v} value={v}>{t(`warnWhen.${k}`)}</option>)}
          </select>
        </label>
        <label className="flex items-start justify-between gap-4 text-sm">
          <span className="grid"><span>{t("alertManager")}</span><span className="text-xs text-muted">{t("alertManagerHelp")}</span></span>
          <input
            type="checkbox"
            role="switch"
            checked={s.alertManager}
            disabled={!editable.all || pending}
            onChange={(e) => { const v = e.target.checked; apply(actions ? () => actions.saveAlerts(s.warnAt, v) : null, () => setS((cur) => ({ ...cur, alertManager: v })), actions ? t("savedLive") : t("saved")); }}
            className="mt-0.5 size-5 accent-[var(--primary)]"
          />
        </label>
        <p className="text-xs text-muted">{t("unclaimed")}</p>
        {!editable.all && <p className="text-sm text-muted">{t("readOnly")}</p>}
      </section>
    </div>
  );
}
