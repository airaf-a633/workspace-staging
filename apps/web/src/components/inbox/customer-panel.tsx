import { useState } from "react";
import { WarningCircle, X } from "@phosphor-icons/react";
import { canSeeDealValue, covers, type Viewer } from "@app/domain";
import { Badge } from "@/components/ui/surface";
import { buttonClass } from "@/components/ui/button";
import { aed, messageTime } from "./format";
import type { InboxAction } from "./store";
import type { Conversation, Person, Team } from "./types";

const STAGE = { new: ["New", "new"], quoted: ["Quoted", "transit"], won: ["Won", "done"], lost: ["Lost", "fail"] } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-border pt-4">
      <h3 className="text-sm font-medium text-muted">{title}</h3>
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
  onClose?: () => void;
}

export function CustomerPanel({ c, people, teams, viewer, now, dispatch, onClose }: Props) {
  const [task, setTask] = useState("");
  const ct = c.contact;
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? "Someone";
  const canDeals = (viewer.scopes["deals.view"] ?? "none") !== "none";
  const canTasks = covers(viewer, "tasks.manage", c);
  const deals = ct.deals.filter((d) => viewer.scopes["deals.view"] !== "own" || d.ownerId === viewer.memberId);

  function addTask() {
    if (!task.trim()) return;
    dispatch({ type: "addTask", id: c.id, by: viewer.memberId, text: task, at: Date.now() });
    setTask("");
  }

  return (
    <div className="grid content-start gap-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold"><bdi>{ct.name}</bdi></h2>
          {ct.company && <p className="text-sm text-muted">{ct.company}</p>}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className={buttonClass("ghost", "sm")} aria-label="Close customer details">
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </header>

      <dl className="grid gap-1.5 text-sm">
        {(
          [
            ["Phone", <span key="p" className="num">{ct.phone}</span>],
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
          {ct.tags.map((t) => <li key={t} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-sm">{t}</li>)}
        </ul>
      )}
      {ct.possibleDuplicate && (
        <p className="flex gap-2 rounded-[var(--radius-control)] border border-warn bg-warn-soft p-3 text-sm">
          <WarningCircle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
          <span><strong className="font-semibold">Possible duplicate.</strong> {ct.possibleDuplicate}</span>
        </p>
      )}

      <Section title="Handoff history">
        {c.handoffs.length === 0 ? (
          <p className="text-sm text-muted">{c.holderId ? `${name(c.holderId)} has handled this chat from the start.` : "Not handed over yet."}</p>
        ) : (
          <ol className="grid gap-3">
            {c.handoffs.map((h, i) => (
              <li key={i} className="grid gap-1 text-sm">
                <p>
                  <strong className="font-semibold">{name(h.fromId)}</strong> → <strong className="font-semibold">{h.toId ? name(h.toId) : teams.find((t) => t.id === h.toTeamId)?.name}</strong>
                  <span className="text-muted"> · <span className="num">{messageTime(h.at, now)}</span></span>
                </p>
                <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2" dir="auto">{h.note}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {canDeals && (
        <Section title="Open deals">
          {deals.length === 0 ? (
            <p className="text-sm text-muted">No deals yet.</p>
          ) : (
            deals.map((d) => (
              <div key={d.id} className="grid gap-1 rounded-[var(--radius-control)] border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{d.title}</p>
                  <Badge tone={STAGE[d.stage][1]}>{STAGE[d.stage][0]}</Badge>
                </div>
                <p>{canSeeDealValue(viewer, d.ownerId) ? <span className="num">{aed(d.fils)}</span> : <span className="text-muted">Value hidden for your role</span>}</p>
                <p className="text-muted">Deal owner: {name(d.ownerId)}</p>
              </div>
            ))
          )}
        </Section>
      )}

      <Section title="Tasks">
        {ct.tasks.length === 0 && <p className="text-sm text-muted">No follow-ups yet.</p>}
        <ul className="grid gap-1">
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
        {canTasks && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addTask();
            }}
          >
            <label htmlFor={`task-${c.id}`} className="sr-only">New task</label>
            <input
              id={`task-${c.id}`}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Add a follow-up"
              className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm"
            />
            <button type="submit" disabled={!task.trim()} className={buttonClass("secondary")}>Add</button>
          </form>
        )}
      </Section>

      <Section title="Orders">
        {ct.orders.length === 0 ? (
          <p className="text-sm text-muted">No orders. Orders from Shopify, WooCommerce or the Orders pack show here.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {ct.orders.map((o) => (
              <li key={o.no} className="flex justify-between gap-3">
                <span className="grid">
                  <span className="num">{o.no}</span>
                  <span className="text-muted">{o.source}</span>
                </span>
                <span className="grid text-end">
                  <span className="num">{aed(o.fils)}</span>
                  <span className="text-muted">{o.state}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
