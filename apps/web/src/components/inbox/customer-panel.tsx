import { useState } from "react";
import { Plus, Sparkle, UsersThree, X } from "@phosphor-icons/react";
import { canSeeDealValue, covers, type Viewer } from "@app/domain";
import { Badge } from "@/components/ui/surface";
import { buttonClass } from "@/components/ui/button";
import { useFormat, useT } from "@/i18n/client";
import { valueLabel } from "@/i18n/labels";
import type { InboxAction } from "./store";
import type { Conversation, Label, Person, Team } from "./types";
import { ChannelMark } from "@/components/channels/channel-mark";
import { AiTag } from "@/components/ai/ai-tag";
import { STAGE } from "@/components/deals/stages";


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
  /** Other loaded conversations with the same person, on any channel. */
  related: Conversation[];
  labels: Label[];
  onOpenConversation: (id: string) => void;
  people: Person[];
  teams: Team[];
  viewer: Viewer;
  now: number;
  dispatch: (a: InboxAction) => void;
  onClose: () => void;
}

/* Only what exists is shown (decided 2026-09-30): empty sections collapse into one "add" link. */
/** Copilot answers in the preview: built from what the panel already knows (the real one asks the AI). */
type Question = "promised" | "open" | "draft";

export function CustomerPanel({ c, related, labels, onOpenConversation, people, teams, viewer, now, dispatch, onClose }: Props) {
  const [adding, setAdding] = useState(false);
  const [task, setTask] = useState("");
  const [merged, setMerged] = useState<string | null>(null);
  const [asked, setAsked] = useState<Question | null>(null);
  const ct = c.contact;
  const t = useT("panel");
  const o = useT("omni");
  const aiT = useT("aiChat");
  const tAll = useT();
  const fmt = useFormat();
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? tAll("common.someone");
  const canDeals = (viewer.scopes["deals.view"] ?? "none") !== "none";
  const canTasks = covers(viewer, "tasks.manage", c);
  const deals = canDeals ? ct.deals.filter((d) => viewer.scopes["deals.view"] !== "own" || d.ownerId === viewer.memberId) : [];

  const canMerge = (viewer.scopes["contacts.merge"] ?? "none") !== "none";
  const first = ct.name.split(" ")[0];
  const chatLabels = labels.filter((l) => c.labels?.includes(l.id));
  const history = [
    ...related.map((x) => {
      const last = x.messages.filter((m) => m.kind === "in" || m.kind === "out").at(-1);
      return { id: x.id, ch: x.channel, at: last?.at ?? 0, summary: x.subject ?? last?.text ?? "", conversationId: x.id };
    }),
    ...(ct.past ?? []),
  ].sort((a, b) => b.at - a.at);

  function answer(q: Question) {
    if (q === "promised") return aiT.has(`summaries.${c.id}`) ? aiT(`summaries.${c.id}` as "summaries.mariam") : aiT("summaryGeneric", { name: ct.name, count: c.messages.length });
    if (q === "draft") return c.aiSuggestion ?? aiT("genericSuggestion", { name: first });
    const open = [
      ...ct.tasks.filter((x) => !x.done).map((x) => x.text),
      ...ct.deals.filter((d) => d.stage !== "won" && d.stage !== "lost").map((d) => d.title),
      ...ct.orders.filter((x) => x.state !== "Delivered").map((x) => `${x.no} (${valueLabel(tAll, "orderState", x.state)})`),
    ];
    return open.length ? o("panel.copilot.openList", { items: fmt.list(open) }) : o("panel.copilot.nothingOpen");
  }

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
        <button type="button" onClick={onClose} className={buttonClass("ghost", "sm", "-me-2 !px-2")} aria-label={tAll("inbox.closeCustomerDetails")} title={t("closeTitle")}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="grid gap-3 px-5 py-4">
        {ct.company && <p className="-mt-1 text-sm text-muted">{ct.company}</p>}
        <dl className="grid gap-1.5 text-sm">
          {(
            [
              ct.location ? [o("panel.location"), <bdi key="l">{ct.location}</bdi>] : null,
              ct.phone ? [t("phone"), <span key="p" className="tabular-nums" dir="ltr">{ct.phone}</span>] : null,
              ct.email ? [t("email"), <span key="e" className="break-all" dir="ltr">{ct.email}</span>] : null,
              [t("language"), valueLabel(tAll, "language", ct.language)],
              [t("team"), teams.find((x) => x.id === c.teamId)?.name ?? tAll("common.none")],
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
          <ul className="flex flex-wrap gap-1.5" aria-label={tAll("common.tags")}>
            {ct.tags.map((t) => <li key={t} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{t}</li>)}
          </ul>
        )}
        {chatLabels.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={o("panel.labels")}>
            {chatLabels.map((l) => (
              <li key={l.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs">
                <span className="size-2 rounded-full" style={{ background: l.color }} aria-hidden="true" />
                {l.name}
              </li>
            ))}
          </ul>
        )}
        {ct.merge && (
          <div className="grid gap-2 rounded-[var(--radius-panel)] border border-warn/40 bg-warn-soft p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold"><UsersThree size={18} className="text-warn" aria-hidden="true" /> {o("panel.merge.title")}</p>
            <p className="flex items-center gap-2">
              <ChannelMark ch={ct.merge.ch} size={16} label={tAll(`channels.${ct.merge.ch}`)} />
              <span className="min-w-0"><bdi className="font-medium">{ct.merge.name}</bdi> <span className="break-all text-muted" dir="ltr">{ct.merge.handle}</span></span>
            </p>
            <p className="text-xs text-muted">{o(`panel.merge.reasons.${ct.merge.reason}`)}</p>
            {canMerge ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass("primary", "sm")}
                  onClick={() => {
                    setMerged(o("panel.merge.merged", { name: first, channel: tAll(`channels.${ct.merge!.ch}`) }));
                    dispatch({ type: "merge", contactId: ct.id });
                  }}
                >
                  {o("panel.merge.merge")}
                </button>
                <button type="button" className={buttonClass("ghost", "sm")} onClick={() => dispatch({ type: "dismissMerge", contactId: ct.id })}>{o("panel.merge.notSame")}</button>
              </div>
            ) : (
              <p className="text-xs text-muted">{o("panel.merge.noRight")}</p>
            )}
          </div>
        )}
        {merged && <p role="status" className="rounded-[var(--radius-control)] bg-done-soft px-3 py-2 text-sm">{merged}</p>}
      </div>

      {ct.identities.length > 0 && (
        <Section title={o("panel.channels")}>
          <ul className="grid gap-2 text-sm">
            {ct.identities.map((i) => (
              <li key={`${i.ch}-${i.handle}`} className="flex min-w-0 items-center gap-2.5">
                <ChannelMark ch={i.ch} size={18} label={false} />
                <span className="shrink-0">{tAll(`channels.${i.ch}`)}</span>
                <span className="min-w-0 truncate text-muted" dir="ltr">{i.handle}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={o("panel.copilot.title", { name: first })}>
        <div className="flex flex-wrap gap-1.5">
          {(["promised", "open", "draft"] as const).map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={asked === q}
              onClick={() => setAsked(q)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${asked === q ? "border-ai/40 bg-ai-soft text-ai" : "border-border text-text hover:bg-surface-2"}`}
            >
              <Sparkle size={12} weight="fill" className="text-ai" aria-hidden="true" />
              {o(`panel.copilot.questions.${q}`)}
            </button>
          ))}
        </div>
        {asked && (
          <div className="grid gap-1.5 rounded-[var(--radius-control)] border border-ai/30 bg-ai-soft p-3 text-sm">
            <AiTag label={o(`panel.copilot.questions.${asked}`)} />
            <p className="whitespace-pre-line" dir="auto">{answer(asked)}</p>
          </div>
        )}
      </Section>

      <Section title={o("panel.history")}>
        {history.length === 0 ? (
          <p className="text-sm text-muted">{o("panel.noHistory")}</p>
        ) : (
          <ul className="grid gap-2.5 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-2.5">
                <ChannelMark ch={h.ch} size={18} label={tAll(`channels.${h.ch}`)} className="mt-0.5" />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate" dir="auto">{h.summary}</span>
                  <span className="text-xs text-muted">{fmt.messageTime(h.at, now)}</span>
                </span>
                {h.conversationId && (
                  <button type="button" onClick={() => onOpenConversation(h.conversationId!)} className="shrink-0 text-xs font-medium text-primary hover:underline">{o("panel.open")}</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {c.handoffs.length > 0 && (
        <Section title={t("handoffs")}>
          <ol className="grid gap-3">
            {c.handoffs.map((h, i) => (
              <li key={i} className="grid gap-1 text-sm">
                <p>
                  <strong className="font-semibold">{name(h.fromId)}</strong> <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span> <strong className="font-semibold">{h.toId ? name(h.toId) : teams.find((x) => x.id === h.toTeamId)?.name}</strong>
                  <span className="text-muted"> · <span className="tabular-nums">{fmt.messageTime(h.at, now)}</span></span>
                </p>
                <p className="text-muted" dir="auto">{h.note}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {deals.length > 0 && (
        <Section title={t("deals", { count: deals.length })}>
          {deals.map((d) => (
            <div key={d.id} className="grid gap-1 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium"><bdi>{d.title}</bdi></p>
                <Badge tone={STAGE[d.stage][1]}>{tAll(`stages.${d.stage}`)}</Badge>
              </div>
              <p className="text-muted">
                {canSeeDealValue(viewer, d.ownerId) ? <span className="tabular-nums text-text">{fmt.money(d.fils)}</span> : t("valueHidden")} · {name(d.ownerId)}
              </p>
            </div>
          ))}
        </Section>
      )}

      {ct.tasks.length > 0 && (
        <Section title={t("followUps")}>
          <ul className="grid">
            {ct.tasks.map((task) => (
              <li key={task.id}>
                <label className="flex min-h-11 items-start gap-3 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={task.done}
                    disabled={!canTasks}
                    onChange={() => dispatch({ type: "toggleTask", id: c.id, taskId: task.id })}
                    className="mt-0.5 size-5 accent-[var(--primary)]"
                  />
                  <span className="grid">
                    <span className={task.done ? "text-muted line-through" : ""}><bdi>{task.text}</bdi></span>
                    <span className="text-muted">{name(task.ownerId)} · {t("due", { when: valueLabel(tAll, "due", task.due) })}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {ct.orders.length > 0 && (
        <Section title={t("orders")}>
          <ul className="grid gap-2 text-sm">
            {ct.orders.map((o) => (
              <li key={o.no} className="flex justify-between gap-3">
                <span className="grid">
                  <span className="tabular-nums">{o.no}</span>
                  <span className="text-muted">{valueLabel(tAll, "orderSource", o.source)}</span>
                </span>
                <span className="grid text-end">
                  <span className="tabular-nums">{fmt.money(o.fils)}</span>
                  <span className="text-muted">{valueLabel(tAll, "orderState", o.state)}</span>
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
              <label htmlFor={`task-${c.id}`} className="sr-only">{t("newFollowUp")}</label>
              <input
                id={`task-${c.id}`}
                autoFocus
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder={t("followUpPlaceholder")}
                className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm"
              />
              <button type="submit" disabled={!task.trim()} className={buttonClass("secondary", "sm")}>{tAll("common.add")}</button>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Plus size={16} aria-hidden="true" /> {t("addFollowUp")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
