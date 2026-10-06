"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowsClockwise, CalendarBlank, CaretDown, ChatText, Clock, Plus } from "@phosphor-icons/react";
import { covers, type Viewer } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import type { Person } from "@/components/inbox/types";
import { useFormat, useT, useTimeZone } from "@/i18n/client";
import { valueLabel } from "@/i18n/labels";
import { daysToWeekEnd, dueAt, nextDue, pickedDate, snoozeTo, whenOf, type BoardTask, type When } from "./sample";

type View = "mine" | "team" | "all";
const ORDER: When[] = ["overdue", "today", "tomorrow", "week", "later", "none"];
// In this file `t` is a task, so the translator is `tr`.

interface Props {
  tasks: BoardTask[];
  people: Person[];
  customers: { id: string; name: string }[];
  viewer: Viewer;
  now: number;
  base: string;
}

/* Tasks as one calm list grouped by when (decided 2026-09-30). Managers switch to their team, grouped by person. */
export function TaskList({ tasks: initial, people, customers, viewer, now, base }: Props) {
  const me = viewer.memberId;
  const scope = viewer.scopes["tasks.manage"] ?? "none";
  const [tasks, setTasks] = useState(initial);
  const [view, setView] = useState<View>("mine");
  const [showDone, setShowDone] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ before: BoardTask; created: string | null } | null>(null);
  const [draft, setDraft] = useState({ text: "", customerId: "", when: "today", date: "", time: "", ownerId: me, repeat: "" });
  const [comment, setComment] = useState("");

  const tr = useT("tasks");
  const tAll = useT();
  const fmt = useFormat();
  const tz = useTimeZone();
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? tAll("common.someone");
  const ref = (t: BoardTask) => ({ teamId: t.teamId, holderId: t.ownerId });
  const canManage = (t: BoardTask) => covers(viewer, "tasks.manage", ref(t));
  const canSee = (t: BoardTask) => t.ownerId === me || scope === "all" || viewer.teamIds.includes(t.teamId);
  const views: [View, string][] = (
    [
      ["mine", tr("views.mine")],
      ["team", tr("views.team")],
      ["all", tr("views.all")],
    ] as [View, string][]
  ).filter(([v]) => v === "mine" || (v === "team" && scope !== "own") || (v === "all" && scope === "all"));
  const assignable = scope === "team" || scope === "all";

  const visible = tasks.filter(canSee).filter((t) => (view === "mine" ? t.ownerId === me : view === "team" ? viewer.teamIds.includes(t.teamId) || t.ownerId === me : true));
  const openTasks = visible.filter((t) => !t.done).sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
  const doneTasks = visible.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  function update(id: string, patch: Partial<BoardTask>) {
    setTasks((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function complete(t: BoardTask) {
    if (t.done) {
      update(t.id, { done: false, doneAt: undefined });
      return;
    }
    const next = nextDue(t, tz);
    const createdId = next ? `${t.id}-r${tasks.length}` : null;
    setTasks((all) => [
      ...all.map((x) => (x.id === t.id ? { ...x, done: true, doneAt: Date.now() } : x)),
      ...(next && createdId ? [{ ...t, id: createdId, due: next, done: false, doneAt: undefined, comments: [] }] : []),
    ]);
    setUndo({ before: t, created: createdId });
    window.setTimeout(() => setUndo((u) => (u?.before.id === t.id ? null : u)), 6000);
  }

  function undoComplete() {
    if (!undo) return;
    setTasks((all) => all.filter((x) => x.id !== undo.created).map((x) => (x.id === undo.before.id ? undo.before : x)));
    setUndo(null);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.text.trim()) return;
    const days = { today: 0, tomorrow: 1, week: daysToWeekEnd(now, tz) } as Record<string, number>;
    let due: number | null = null;
    let hasTime = false;
    if (draft.when === "date" && draft.date) {
      due = pickedDate(draft.date, draft.time, tz);
      hasTime = !!draft.time;
    } else if (draft.when in days) {
      ({ due, hasTime } = dueAt(days[draft.when], draft.time || null, now, tz));
    }
    const c = customers.find((x) => x.id === draft.customerId);
    const task: BoardTask = {
      id: `new-${tasks.length}`,
      text: draft.text.trim(),
      ownerId: draft.ownerId,
      customerId: c?.id ?? null,
      customerName: c?.name ?? null,
      teamId: viewer.teamIds[0] ?? "",
      due,
      hasTime,
      done: false,
      repeat: (draft.repeat || null) as BoardTask["repeat"],
      comments: [],
      calendar: null,
    };
    setTasks([task, ...tasks]);
    setDraft({ ...draft, text: "", customerId: "", time: "", repeat: "" });
  }

  const dueLabel = (t: BoardTask) => {
    if (t.due === null) return null;
    const w = whenOf(t, now, tz);
    const day = w === "today" || w === "tomorrow" ? "" : fmt.listTime(t.due, now);
    const clock = t.hasTime ? fmt.time(t.due) : "";
    return [day, clock].filter(Boolean).join(fmt.locale === "ar" ? "، " : ", ") || null;
  };

  const chip = "min-h-9 rounded-full border border-input bg-surface px-3 text-sm";

  const row = (t: BoardTask) => {
    const editable = canManage(t);
    const w = whenOf(t, now, tz);
    const label = dueLabel(t);
    const expanded = open === t.id;
    return (
      <li key={t.id} className="border-b border-border last:border-0">
        <div className="flex items-start gap-3 px-4 py-3">
          <input
            type="checkbox"
            checked={t.done}
            disabled={!editable}
            onChange={() => complete(t)}
            aria-label={tr(t.done ? "markNotDone" : "markDone", { text: t.text })}
            className="mt-1 size-5 shrink-0 cursor-pointer rounded-full accent-[var(--primary)] disabled:cursor-default"
          />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className={t.done ? "text-muted line-through" : ""}>
              <bdi>{t.text}</bdi>
              {t.customerName && (
                <>
                  <span className="text-muted"> · </span>
                  {t.customerId ? <Link href={`${base}/customers/${t.customerId}`} className="text-primary hover:underline"><bdi>{t.customerName}</bdi></Link> : <bdi className="text-muted">{t.customerName}</bdi>}
                </>
              )}
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
              {label && <span className={`tabular-nums ${w === "overdue" && !t.done ? "font-medium text-warn" : ""}`}>{label}</span>}
              {t.repeat && <span className="inline-flex items-center gap-1"><ArrowsClockwise size={14} aria-hidden="true" />{tr(`repeat.${t.repeat}`)}</span>}
              {t.calendar && <span className="inline-flex items-center gap-1" title={tr("calendarTitle", { name: name(t.ownerId), calendar: valueLabel(tAll, "calendar", t.calendar) })}><CalendarBlank size={14} aria-hidden="true" />{valueLabel(tAll, "calendar", t.calendar)}</span>}
              <button type="button" onClick={() => setOpen(expanded ? null : t.id)} aria-expanded={expanded} className="inline-flex min-h-8 items-center gap-1 hover:text-text">
                <ChatText size={14} aria-hidden="true" />
                {t.comments.length ? tr("notes", { count: t.comments.length }) : tr("addNote")}
              </button>
            </p>
          </div>
          {!t.done && editable && (
            <details className="relative shrink-0">
              <summary className={buttonClass("ghost", "sm", "!px-2 list-none [&::-webkit-details-marker]:hidden")} aria-label={tr("snoozeTask", { text: t.text })} title={tr("snooze")}>
                <Clock size={18} aria-hidden="true" />
              </summary>
              <div className="absolute end-0 top-full z-20 mt-1 grid min-w-44 rounded-[var(--radius-control)] border border-border bg-surface p-1 shadow-[var(--shadow-2)]">
                {(["later", "tomorrow", "week"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={(e) => {
                      update(t.id, snoozeTo(k, now, tz));
                      e.currentTarget.closest("details")?.removeAttribute("open");
                    }}
                    className="min-h-10 rounded px-3 text-start text-sm hover:bg-surface-2"
                  >
                    {tr(`snoozeTo.${k}`)}
                  </button>
                ))}
              </div>
            </details>
          )}
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary" title={name(t.ownerId)} aria-label={tAll("deals.ownerIs", { name: name(t.ownerId) })}>
            {name(t.ownerId).charAt(0)}
          </span>
        </div>
        {expanded && (
          <div className="grid gap-2 px-12 pb-4">
            {t.comments.map((c, i) => (
              <p key={i} className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm" dir="auto">{c.text}<span className="block text-xs text-muted">{name(c.byId)}</span></p>
            ))}
            {editable || t.ownerId === me ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  update(t.id, { comments: [...t.comments, { byId: me, text: comment.trim(), at: Date.now() }] });
                  setComment("");
                }}
              >
                <label className="sr-only" htmlFor={`c-${t.id}`}>{tr("noteOn", { text: t.text })}</label>
                <input id={`c-${t.id}`} autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder={tr("notePlaceholder")} className="min-h-10 min-w-0 flex-1 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm" />
                <button type="submit" disabled={!comment.trim()} className={buttonClass("secondary", "sm")}>{tAll("common.add")}</button>
              </form>
            ) : (
              t.comments.length === 0 && <p className="text-sm text-muted">{tr("noNotes")}</p>
            )}
          </div>
        )}
      </li>
    );
  };

  const groups: [string, BoardTask[], boolean][] =
    view === "mine"
      ? ORDER.map((w) => [tr(`when.${w}`), openTasks.filter((t) => whenOf(t, now, tz) === w), w === "overdue"] as [string, BoardTask[], boolean])
      : [...new Set(openTasks.map((t) => t.ownerId))]
          .sort((a, b) => (a === me ? -1 : b === me ? 1 : name(a).localeCompare(name(b), fmt.locale)))
          .map((owner) => {
            const list = openTasks.filter((t) => t.ownerId === owner);
            const late = list.filter((t) => whenOf(t, now, tz) === "overdue").length;
            const who = owner === me ? tAll("common.you") : name(owner);
            return [late ? tr("personLate", { name: who, open: list.length, late }) : tr("person", { name: who, open: list.length }), list, late > 0] as [string, BoardTask[], boolean];
          });

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="sr-only">{tr("title")}</h1>
        <label className="relative flex items-center">
          <span className="sr-only">{tr("show")}</span>
          <select value={view} onChange={(e) => setView(e.target.value as View)} className="title cursor-pointer appearance-none bg-transparent pe-7 text-3xl [field-sizing:content] sm:text-4xl">
            {views.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <CaretDown size={18} className="pointer-events-none absolute end-0 text-muted" aria-hidden="true" />
        </label>
        <span className="text-sm tabular-nums text-muted">{tr("openCount", { count: openTasks.length })}</span>
      </header>

      {scope !== "none" && (
        <form onSubmit={add} className="grid gap-2 rounded-[var(--radius-panel)] bg-surface p-3 shadow-[var(--shadow-1)] ring-1 ring-border" aria-label={tr("form")}>
          <div className="flex items-center gap-2">
            <Plus size={18} className="ms-1 shrink-0 text-muted" aria-hidden="true" />
            <label className="sr-only" htmlFor="new-task">{tr("placeholder")}</label>
            <input id="new-task" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder={tr("placeholder")} className="min-h-10 min-w-0 flex-1 bg-transparent text-base placeholder:text-muted focus:outline-none" />
            <button type="submit" disabled={!draft.text.trim()} className={buttonClass("primary", "sm")}>{tAll("common.add")}</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 ps-7">
            <select aria-label={tr("customer")} value={draft.customerId} onChange={(e) => setDraft({ ...draft, customerId: e.target.value })} className={chip}>
              <option value="">{tr("noCustomer")}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label={tr("whenLabel")} value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value })} className={chip}>
              <option value="today">{tr("pick.today")}</option>
              <option value="tomorrow">{tr("pick.tomorrow")}</option>
              <option value="week">{tr("pick.week")}</option>
              <option value="date">{tr("pick.date")}</option>
              <option value="none">{tr("pick.none")}</option>
            </select>
            {draft.when === "date" && <input type="date" aria-label={tr("date")} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={chip} />}
            {draft.when !== "none" && <input type="time" aria-label={tr("time")} value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className={chip} />}
            <select aria-label={tr("repeatLabel")} value={draft.repeat} onChange={(e) => setDraft({ ...draft, repeat: e.target.value })} className={chip}>
              <option value="">{tr("noRepeat")}</option>
              <option value="daily">{tr("repeat.daily")}</option>
              <option value="weekly">{tr("repeat.weekly")}</option>
              <option value="monthly">{tr("repeat.monthly")}</option>
            </select>
            {assignable && (
              <select aria-label={tr("owner")} value={draft.ownerId} onChange={(e) => setDraft({ ...draft, ownerId: e.target.value })} className={chip}>
                {people.filter((p) => !p.sample && p.canReply).map((p) => <option key={p.id} value={p.id}>{p.id === me ? tr("me") : p.name}</option>)}
              </select>
            )}
          </div>
        </form>
      )}

      {openTasks.length === 0 && (
        <p className="rounded-[var(--radius-panel)] bg-surface p-6 text-muted shadow-[var(--shadow-1)] ring-1 ring-border">{tr("empty")}</p>
      )}

      {groups.map(([title, list, warn]) =>
        list.length === 0 ? null : (
          <section key={title} className="grid gap-2">
            <h2 className={`text-xs font-medium uppercase tracking-wide ${warn ? "text-warn" : "text-muted"}`}>{title}{view === "mine" && ` · ${fmt.number(list.length)}`}</h2>
            <ul className="overflow-visible rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">{list.map(row)}</ul>
          </section>
        ),
      )}

      {doneTasks.length > 0 && (
        <section className="grid gap-2">
          <button type="button" onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className="flex w-fit items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted hover:text-text">
            {tr("doneCount", { count: doneTasks.length })} <CaretDown size={12} className={showDone ? "rotate-180" : ""} aria-hidden="true" />
          </button>
          {showDone && <ul className="rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">{doneTasks.map(row)}</ul>}
        </section>
      )}

      {undo && (
        <div role="status" className="fixed inset-x-0 bottom-20 z-30 mx-auto flex w-fit max-w-[90vw] items-center gap-4 rounded-full bg-text px-5 py-2.5 text-sm text-bg shadow-[var(--shadow-2)] lg:bottom-6">
          <span>{undo.created ? tr("doneNext", { text: undo.before.text, when: fmt.listTime(nextDue(undo.before, tz) ?? now, now) }) : tr("doneToast", { text: undo.before.text })}</span>
          <button type="button" onClick={undoComplete} className="font-semibold underline-offset-2 hover:underline">{tr("undo")}</button>
        </div>
      )}
    </div>
  );
}
