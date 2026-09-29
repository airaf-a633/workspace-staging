import { useState } from "react";
import { Plus, WarningCircle, X } from "@phosphor-icons/react";
import { canSeeDealValue, covers, type Viewer } from "@app/domain";
import { Badge } from "@/components/ui/surface";
import { buttonClass } from "@/components/ui/button";
import { aed, messageTime } from "./format";
import type { InboxAction } from "./store";
import type { Conversation, Person, Team } from "./types";

const STAGE = { new: ["New", "new"], quoted: ["Quoted", "transit"], won: ["Won", "done"], lost: ["Lost", "fail"] } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2.5 border-t border-border px-5 py-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

interface Props {
  c: Conversation;
  people: Person[];
  teams: Team[];
  viewer: Viewer;
  now: number;
  dispatch: (a: InboxAction) => void;
  onClose: () => void;
}

/* Only what exists is shown (decided 2026-09-30): empty sections collapse into one "add" link. */
export function CustomerPanel({ c, people, teams, viewer, now, dispatch, onClose }: Props) {
  const [adding, setAdding] = useState(false);
  const [task, setTask] = useState("");
  const ct = c.contact;
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? "Someone";
  const canDeals = (viewer.scopes["deals.view"] ?? "none") !== "none";
  const canTasks = covers(viewer, "tasks.manage", c);
  const deals = canDeals ? ct.deals.filter((d) => viewer.scopes["deals.view"] !== "own" || d.ownerId === viewer.memberId) : [];

  function addTask() {
    if (!task.trim()) return;
    dispatch({ type: "addTask", id: c.id, by: viewer.memberId, text: task, at: Date.now() });
    setTask("");
    setAdding(false);
  }

  return (
    <div className="grid content-start">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-border px-5">
        <h2 className="truncate font-semibold"><bdi>{ct.name}</bdi></h2>
        <button type="button" onClick={onClose} className={buttonClass("ghost", "sm", "-me-2 !px-2")} aria-label="Close customer details" title="Close (Esc)">
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="grid gap-3 px-5 py-4">
        {ct.company && <p className="-mt-1 text-sm text-muted">{ct.company}</p>}
        <dl className="grid gap-1.5 text-sm">
          {(
            [
              ["Phone", <span key="p" className="tabular-nums" dir="ltr">{ct.phone}</span>],
              ct.email ? ["Email", <span key="e" className="break-all">{ct.email}</span>] : null,
              ["Language", ct.language],
              ["Team", teams.find((t) => t.id === c.teamId)?.name ?? "None"],
            ] satisfies ([string, React.ReactNode] | null)[]
          )
            .filter((r) => r !== null)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted">{k}</dt>
                <dd className="min-w-0 text-end">{v}</dd>
              </div>
            ))}
        </dl>
        {ct.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
            {ct.tags.map((t) => <li key={t} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{t}</li>)}
          </ul>
        )}
        {ct.possibleDuplicate && (
          <p className="flex gap-2 rounded-[var(--radius-control)] bg-warn-soft p-3 text-sm">
            <WarningCircle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            <span><strong className="font-semibold">Possible duplicate.</strong> {ct.possibleDuplicate}</span>
          </p>
        )}
      </div>

      {c.handoffs.length > 0 && (
        <Section title="Handoffs">
          <ol className="grid gap-3">
            {c.handoffs.map((h, i) => (
              <li key={i} className="grid gap-1 text-sm">
                <p>
                  <strong className="font-semibold">{name(h.fromId)}</strong> → <strong className="font-semibold">{h.toId ? name(h.toId) : teams.find((t) => t.id === h.toTeamId)?.name}</strong>
                  <span className="text-muted"> · <span className="tabular-nums">{messageTime(h.at, now)}</span></span>
                </p>
                <p className="text-muted" dir="auto">{h.note}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {deals.length > 0 && (
        <Section title={deals.length === 1 ? "Deal" : "Deals"}>
          {deals.map((d) => (
            <div key={d.id} className="grid gap-1 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{d.title}</p>
                <Badge tone={STAGE[d.stage][1]}>{STAGE[d.stage][0]}</Badge>
              </div>
              <p className="text-muted">
                {canSeeDealValue(viewer, d.ownerId) ? <span className="tabular-nums text-text">{aed(d.fils)}</span> : "Value hidden for your role"} · {name(d.ownerId)}
              </p>
            </div>
          ))}
        </Section>
      )}

      {ct.tasks.length > 0 && (
        <Section title="Follow-ups">
          <ul className="grid">
            {ct.tasks.map((t) => (
              <li key={t.id}>
                <label className="flex min-h-11 items-start gap-3 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={!canTasks}
                    onChange={() => dispatch({ type: "toggleTask", id: c.id, taskId: t.id })}
                    className="mt-0.5 size-5 accent-[var(--primary)]"
                  />
                  <span className="grid">
                    <span className={t.done ? "text-muted line-through" : ""}>{t.text}</span>
                    <span className="text-muted">{name(t.ownerId)} · {t.due}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {ct.orders.length > 0 && (
        <Section title="Orders">
          <ul className="grid gap-2 text-sm">
            {ct.orders.map((o) => (
              <li key={o.no} className="flex justify-between gap-3">
                <span className="grid">
                  <span className="tabular-nums">{o.no}</span>
                  <span className="text-muted">{o.source}</span>
                </span>
                <span className="grid text-end">
                  <span className="tabular-nums">{aed(o.fils)}</span>
                  <span className="text-muted">{o.state}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {canTasks && (
        <div className="border-t border-border px-5 py-3">
          {adding ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addTask();
              }}
            >
              <label htmlFor={`task-${c.id}`} className="sr-only">New follow-up</label>
              <input
                id={`task-${c.id}`}
                autoFocus
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="What needs doing?"
                className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm"
              />
              <button type="submit" disabled={!task.trim()} className={buttonClass("secondary", "sm")}>Add</button>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Plus size={16} aria-hidden="true" /> Add a follow-up
            </button>
          )}
        </div>
      )}
    </div>
  );
}
