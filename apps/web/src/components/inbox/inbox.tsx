"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChatsCircle, DotsThree, EnvelopeSimple, Keyboard, MagnifyingGlass, UserList, WhatsappLogo } from "@phosphor-icons/react";
import { conversationActions, handoffNoteError, replyAccess, windowOpen, type Viewer } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { Composer, type ComposerMode } from "./composer";
import { CustomerPanel } from "./customer-panel";
import { listTime, waitedFor } from "./format";
import { MessageItem, mediaLabel } from "./message";
import { lastActivity, reducer, stamp, type InboxAction } from "./store";
import type { Conversation, InboxData, Person } from "./types";

type Filter = "mine" | "teams" | "unassigned" | "all" | "spam";
const REPLY_TARGET_MIN = 30;

const SHORTCUTS: [string, string][] = [
  ["J / K", "Next / previous chat"],
  ["R", "Reply"],
  ["N", "Internal note"],
  ["H", "Hand over"],
  ["E", "Resolve or reopen"],
  ["/", "Search"],
  ["Esc", "Close"],
  ["?", "Show shortcuts"],
];

function lastReal(c: Conversation) {
  const real = c.messages.filter((m) => m.kind !== "event");
  return real[real.length - 1];
}

function rowStatus(c: Conversation, now: number): { label: string; tone: "new" | "transit" | "done" | "warn" | "fail" } | null {
  if (c.status === "spam") return null;
  if (c.imported) return { label: "Imported", tone: "new" };
  if (c.status === "resolved") return { label: "Resolved", tone: "done" };
  const last = lastReal(c);
  if (last?.status === "failed") return { label: "Not delivered", tone: "fail" };
  if (!c.holderId) {
    const over = last?.kind === "in" && c.lastCustomerAt !== null && now - c.lastCustomerAt > REPLY_TARGET_MIN * 60_000;
    return over ? { label: "Over reply target", tone: "warn" } : { label: "Unassigned", tone: "new" };
  }
  if (c.channel === "whatsapp" && !windowOpen(c.lastCustomerAt, now)) return { label: "24h window closed", tone: "warn" };
  if (last?.kind === "out") return { label: "Waiting on customer", tone: "transit" };
  return null;
}

function snippet(c: Conversation, people: Person[], me: string) {
  const m = lastReal(c);
  if (!m) return "";
  const body = m.deleted ? "Deleted message" : m.subject ?? m.text ?? (m.media ? mediaLabel(m.media) : "");
  if (m.kind === "note") return `Note: ${body}`;
  if (m.kind === "out") return `${m.authorId === me ? "You" : people.find((p) => p.id === m.authorId)?.name ?? "Team"}: ${body}`;
  return body;
}

function Trail({ ids, people, compact }: { ids: string[]; people: Person[]; compact?: boolean }) {
  if (ids.length === 0) return null;
  return (
    <ol className="flex flex-wrap items-center gap-1 text-sm" aria-label="Handled by, in order">
      {ids.map((id, i) => {
        const p = people.find((x) => x.id === id);
        const current = i === ids.length - 1;
        return (
          <li key={`${id}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true" className="text-muted rtl:rotate-180">→</span>}
            <span className={current ? "rounded-full bg-primary-soft px-2 font-semibold text-primary" : "text-muted"}>
              {p?.name ?? "Someone"}
              {!compact && current && p ? <span className="font-normal">, {p.role}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Inbox({ data }: { data: InboxData }) {
  const { now, people, teams } = data;
  const viewer: Viewer = data.viewer;
  const me = viewer.memberId;
  const [conversations, dispatch] = useReducer(useMemo(() => reducer({ people, teams }), [people, teams]), data.conversations);

  const params = useSearchParams();
  const selectedId = params.get("c");
  const [filter, setFilter] = useState<Filter>("mine");
  const [showResolved, setShowResolved] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ComposerMode>("reply");
  const [handing, setHanding] = useState(false);
  const [confirmSpam, setConfirmSpam] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [help, setHelp] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const canSeeAll = viewer.scopes["conversations.view"] === "all";
  const visible = conversations.filter((c) => replyAccess(viewer, c) !== "hidden");
  const byRecent = (a: Conversation, b: Conversation) => lastActivity(b) - lastActivity(a);
  const isMine = (c: Conversation) => c.holderId === me || c.collaboratorIds.includes(me);
  const matches = (c: Conversation) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const digits = q.replace(/\D/g, "");
    return (
      c.contact.name.toLowerCase().includes(q) ||
      (digits.length >= 3 && c.contact.phone.replace(/\D/g, "").includes(digits)) ||
      c.messages.some((m) => (m.text ?? m.subject ?? "").toLowerCase().includes(q))
    );
  };

  const inFilter = (c: Conversation, f: Filter) => {
    if (f === "spam") return c.status === "spam";
    if (c.status === "spam") return false;
    if (f === "mine") return isMine(c) || (!c.holderId && replyAccess(viewer, c) === "claim");
    if (f === "teams") return viewer.teamIds.includes(c.teamId);
    if (f === "unassigned") return !c.holderId;
    return true;
  };
  const statusOk = (c: Conversation) => filter === "spam" || (showResolved ? c.status === "resolved" : c.status === "open");
  const list = visible.filter((c) => inFilter(c, filter) && statusOk(c) && matches(c)).sort(byRecent);
  const openCount = (f: Filter) => visible.filter((c) => inFilter(c, f) && (f === "spam" || c.status === "open")).length;

  // "Mine" shows chats I hold first, then unassigned chats I can claim (decided 2026-09-29).
  const groups: [string | null, Conversation[]][] =
    filter === "mine" && !showResolved
      ? [
          ["Yours", list.filter(isMine)],
          ["Waiting to be claimed", list.filter((c) => !isMine(c))],
        ]
      : [[null, list]];
  const ordered = groups.flatMap(([, g]) => g);

  const selected = visible.find((c) => c.id === selectedId) ?? null;
  const actions = selected ? conversationActions(viewer, selected) : null;

  function select(id: string | null) {
    setHanding(false);
    setConfirmSpam(false);
    setPanelOpen(false);
    setMode("reply");
    if (id) dispatch({ type: "open", id });
    // Native history keeps the chat in the URL (shareable, Back returns to the list) without a server round trip.
    window.history.pushState(null, "", id ? `?c=${id}` : window.location.pathname);
  }

  function toggleResolve() {
    if (!selected || !actions?.canResolve) return;
    dispatch({ type: selected.status === "resolved" ? "reopen" : "resolve", id: selected.id, by: me, at: stamp() });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t.closest("input, textarea, select, [contenteditable=true]");
      if (e.key === "Escape") {
        setHanding(false);
        setConfirmSpam(false);
        setPanelOpen(false);
        setHelp(false);
        if (typing) (t as HTMLElement).blur();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      // On a focused button or link, only navigation shortcuts work, so a stray key can't change a chat.
      if (t.closest("button, a, summary") && !["j", "k", "/", "?"].includes(e.key)) return;
      const i = ordered.findIndex((c) => c.id === selectedId);
      const focusSoon = (el: { current: HTMLElement | null }) => requestAnimationFrame(() => el.current?.focus());
      switch (e.key) {
        case "j":
        case "k": {
          const next = ordered[e.key === "j" ? Math.min(ordered.length - 1, i + 1) : Math.max(0, i - 1)];
          if (next && next.id !== selectedId) select(next.id);
          break;
        }
        case "r":
          if (!selected) return;
          setMode("reply");
          focusSoon(replyRef);
          break;
        case "n":
          if (!actions?.canWriteNotes) return;
          setMode("note");
          focusSoon(noteRef);
          break;
        case "h":
          if (actions?.canHandOver && selected?.status !== "spam") setHanding(true);
          break;
        case "e":
          toggleResolve();
          break;
        case "/":
          searchRef.current?.focus();
          break;
        case "?":
          setHelp((h) => !h);
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const chip = (f: Filter, label: string) => (
    <button
      key={f}
      type="button"
      aria-pressed={filter === f}
      onClick={() => setFilter(f)}
      className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm ${
        filter === f ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border text-text hover:bg-surface-2"
      }`}
    >
      {label}
      <span className="num text-muted">{openCount(f)}</span>
    </button>
  );

  const hasSamplePeople = people.some((p) => p.sample);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p role="note" className="border-b border-border bg-surface-2 px-4 py-2 text-sm">
        <strong className="font-semibold">Sample chats.</strong>{" "}
        <span className="hidden sm:inline">This is how your inbox works once WhatsApp is connected. </span>
        Nothing is sent to anyone, and changes reset when you reload.
        {hasSamplePeople && <span className="hidden md:inline"> Some teammates here are samples too.</span>}
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        {/* Conversation list */}
        <section aria-label="Conversations" className={`${selected ? "hidden md:flex" : "flex"} min-h-0 flex-col border-e border-border bg-surface`}>
          <div className="grid gap-3 border-b border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="title text-2xl">Inbox</h1>
              <button type="button" onClick={() => setHelp((h) => !h)} className={buttonClass("ghost", "sm", "hidden md:inline-flex")} aria-expanded={help} title="Keyboard shortcuts (?)">
                <Keyboard size={20} aria-hidden="true" />
                <span className="sr-only">Keyboard shortcuts</span>
              </button>
            </div>
            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <MagnifyingGlass size={20} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats"
                title="Search by name, number or message (/)"
                className="min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface ps-10 pe-3 text-base placeholder:text-muted"
              />
            </label>
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]" role="group" aria-label="Filter">
              {chip("mine", "Mine")}
              {chip("teams", "My teams")}
              {chip("unassigned", "Unassigned")}
              {canSeeAll && chip("all", "All")}
              {chip("spam", "Spam")}
            </div>
            {filter !== "spam" && (
              <div className="flex gap-4 text-sm" role="group" aria-label="Status">
                {[false, true].map((r) => (
                  <button
                    key={String(r)}
                    type="button"
                    aria-pressed={showResolved === r}
                    onClick={() => setShowResolved(r)}
                    className={`min-h-9 border-b-2 ${showResolved === r ? "border-primary font-semibold text-primary" : "border-transparent text-muted hover:text-text"}`}
                  >
                    {r ? "Resolved" : "Open"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {help && (
            <div className="border-b border-border bg-surface-2 p-3">
              <p className="mb-2 text-sm font-semibold">Keyboard shortcuts</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {SHORTCUTS.map(([k, d]) => (
                  <div key={k} className="contents">
                    <dt><kbd className="num rounded border border-border bg-surface px-1.5">{k}</kbd></dt>
                    <dd>{d}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {ordered.length === 0 ? (
              <p className="p-6 text-center text-muted">
                {query ? "No chats match your search." : filter === "mine" ? "Nothing needs you right now." : filter === "spam" ? "No spam. Nice." : "No chats here."}
              </p>
            ) : (
              groups.map(([title, g]) =>
                g.length === 0 ? null : (
                  <div key={title ?? "all"}>
                    {title && <h2 className="sticky top-0 z-[1] bg-surface-2 px-3 py-1.5 text-sm font-medium text-muted">{title}</h2>}
                    <ul>
                      {g.map((c) => {
                        const st = rowStatus(c, now);
                        const on = c.id === selectedId;
                        const waiting = !c.holderId && c.status === "open" && c.lastCustomerAt ? waitedFor(c.lastCustomerAt, now) : null;
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => select(c.id)}
                              aria-current={on ? "true" : undefined}
                              className={`grid w-full gap-1 border-b border-border px-3 py-3 text-start ${on ? "bg-primary-soft" : "hover:bg-surface-2"}`}
                            >
                              <span className="flex items-baseline justify-between gap-2">
                                <span className={`truncate ${c.unread ? "font-semibold" : "font-medium"}`}><bdi>{c.contact.name}</bdi></span>
                                <span className="num shrink-0 text-sm text-muted">{listTime(lastActivity(c), now)}</span>
                              </span>
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm text-muted" dir="auto">{snippet(c, people, me)}</span>
                                {c.unread > 0 && (
                                  <span className="num shrink-0 rounded-full bg-primary px-2 text-sm text-on-primary" aria-label={`${c.unread} unread`}>{c.unread}</span>
                                )}
                              </span>
                              <span className="flex flex-wrap items-center gap-2">
                                {c.channel === "email" ? (
                                  <EnvelopeSimple size={18} className="text-muted" aria-label="Email" />
                                ) : (
                                  <WhatsappLogo size={18} className="text-muted" aria-label="WhatsApp" />
                                )}
                                {st && <Badge tone={st.tone}>{st.label}</Badge>}
                                {waiting && <span className="text-sm text-muted">waiting {waiting}</span>}
                                <Trail ids={c.trail} people={people} compact />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ),
              )
            )}
          </div>
        </section>

        {/* Thread */}
        <section aria-label="Conversation" className={`${selected ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col bg-bg`}>
          {!selected || !actions ? (
            <div className="grid flex-1 place-content-center justify-items-center gap-3 p-8 text-center text-muted">
              <ChatsCircle size={48} aria-hidden="true" />
              <p>Choose a chat to read it.</p>
              <p className="hidden text-sm md:block">Tip: press <kbd className="num rounded border border-border bg-surface px-1.5">J</kbd> to open the first one.</p>
            </div>
          ) : (
            <Thread
              key={selected.id}
              c={selected}
              actions={actions}
              people={people}
              teams={data.teams}
              viewer={viewer}
              now={now}
              mode={mode}
              setMode={setMode}
              handing={handing}
              setHanding={setHanding}
              confirmSpam={confirmSpam}
              setConfirmSpam={setConfirmSpam}
              onBack={() => select(null)}
              onDetails={() => setPanelOpen(true)}
              onToggleResolve={toggleResolve}
              replyRef={replyRef}
              noteRef={noteRef}
              dispatch={dispatch}
            />
          )}
        </section>

        {/* Customer panel: a column on wide screens, a sheet on smaller ones */}
        {selected && (
          <>
            <aside aria-label="Customer" className="hidden min-h-0 overflow-y-auto border-s border-border bg-surface 2xl:block">
              <CustomerPanel c={selected} people={people} teams={teams} viewer={viewer} now={now} dispatch={dispatch} />
            </aside>
            {panelOpen && (
              <div className="fixed inset-0 z-40 2xl:hidden">
                <button type="button" aria-label="Close customer details" onClick={() => setPanelOpen(false)} className="absolute inset-0 bg-black/40" />
                <aside aria-label="Customer" className="absolute inset-y-0 end-0 w-full max-w-sm overflow-y-auto bg-surface shadow-[var(--shadow-2)]">
                  <CustomerPanel c={selected} people={people} teams={teams} viewer={viewer} now={now} dispatch={dispatch} onClose={() => setPanelOpen(false)} />
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ThreadProps {
  c: Conversation;
  actions: NonNullable<ReturnType<typeof conversationActions>>;
  people: Person[];
  teams: InboxData["teams"];
  viewer: Viewer;
  now: number;
  mode: ComposerMode;
  setMode: (m: ComposerMode) => void;
  handing: boolean;
  setHanding: (v: boolean) => void;
  confirmSpam: boolean;
  setConfirmSpam: (v: boolean) => void;
  onBack: () => void;
  onDetails: () => void;
  onToggleResolve: () => void;
  replyRef: React.RefObject<HTMLTextAreaElement | null>;
  noteRef: React.RefObject<HTMLTextAreaElement | null>;
  dispatch: (a: InboxAction) => void;
}

function Thread(p: ThreadProps) {
  const { c, actions, people, teams, viewer, now, dispatch } = p;
  const me = viewer.memberId;
  const holder = people.find((x) => x.id === c.holderId);
  const followers = c.trail.slice(0, -1).filter((id, i, a) => id !== c.holderId && a.indexOf(id) === i);
  const team = teams.find((t) => t.id === c.teamId);
  const pinned = c.handoffs[c.handoffs.length - 1];
  const endRef = useRef<HTMLDivElement>(null);
  const count = c.messages.length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  return (
    <>
      <header className="grid gap-2 border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 basis-56 items-start gap-2">
            <button type="button" onClick={p.onBack} className={buttonClass("ghost", "sm", "-ms-2 md:hidden")} aria-label="Back to chats">
              <ArrowLeft size={20} className="rtl:rotate-180" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                <bdi className="truncate">{c.contact.name}</bdi>
                <span className="inline-flex items-center gap-1 text-sm font-normal text-muted">
                  {c.channel === "email" ? <EnvelopeSimple size={16} aria-hidden="true" /> : <WhatsappLogo size={16} aria-hidden="true" />}
                  {c.channel === "email" ? "Outlook" : "WhatsApp"}
                </span>
                {c.imported && <Badge>Imported</Badge>}
                {c.status === "resolved" && <Badge tone="done">Resolved</Badge>}
                {c.status === "spam" && <Badge tone="fail">Spam</Badge>}
              </h2>
              <p className="text-sm text-muted">
                {c.imported
                  ? "Imported from the phone when the number was connected. No notifications or reply targets."
                  : holder
                    ? <>Handled by <strong className="font-semibold text-text">{holder.name}</strong>, {holder.role}{team ? ` · ${team.name}` : ""}</>
                    : <>Unassigned{team ? ` · ${team.name}` : ""}</>}
                {followers.length > 0 && <> · Following: {followers.map((id) => people.find((x) => x.id === id)?.name).join(", ")}</>}
              </p>
            </div>
          </div>

          <div className="ms-auto flex shrink-0 items-center gap-1">
            <button type="button" onClick={p.onDetails} className={buttonClass("ghost", "sm", "2xl:hidden")} title="Customer details" aria-label="Customer details">
              <UserList size={20} aria-hidden="true" />
              <span className="hidden sm:inline">Details</span>
            </button>
            {actions.canHandOver && c.status !== "spam" && (
              <button type="button" onClick={() => p.setHanding(!p.handing)} aria-expanded={p.handing} className={buttonClass("secondary", "sm")} title="Hand over (H)">
                Hand over
              </button>
            )}
            {actions.canResolve && c.status !== "spam" && (
              <button type="button" onClick={p.onToggleResolve} className={buttonClass("secondary", "sm", "hidden sm:inline-flex")} title={`${c.status === "resolved" ? "Reopen" : "Resolve"} (E)`}>
                {c.status === "resolved" ? "Reopen" : "Resolve"}
              </button>
            )}
            {(actions.canMarkSpam || actions.canResolve) && (
              <details className="relative">
                <summary className={buttonClass("ghost", "sm", "list-none [&::-webkit-details-marker]:hidden")} aria-label="More actions">
                  <DotsThree size={22} weight="bold" aria-hidden="true" />
                </summary>
                <div className="absolute end-0 top-full z-20 mt-1 grid min-w-48 rounded-[var(--radius-control)] border border-border bg-surface p-1 shadow-[var(--shadow-2)]">
                  {actions.canResolve && c.status !== "spam" && (
                    <button type="button" onClick={p.onToggleResolve} className="min-h-11 rounded px-3 text-start hover:bg-surface-2 sm:hidden">
                      {c.status === "resolved" ? "Reopen" : "Resolve"}
                    </button>
                  )}
                  {actions.canMarkSpam &&
                    (c.status === "spam" ? (
                      <button type="button" onClick={() => dispatch({ type: "notSpam", id: c.id, by: me, at: stamp() })} className="min-h-11 rounded px-3 text-start hover:bg-surface-2">
                        Not spam
                      </button>
                    ) : (
                      <button type="button" onClick={() => p.setConfirmSpam(true)} className="min-h-11 rounded px-3 text-start text-fail hover:bg-surface-2">
                        Mark as spam…
                      </button>
                    ))}
                </div>
              </details>
            )}
          </div>
        </div>
        {c.trail.length > 1 && <Trail ids={c.trail} people={people} />}
      </header>

      {p.confirmSpam && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-fail-soft px-4 py-3">
          <p className="text-sm">
            Mark <bdi className="font-semibold">{c.contact.name}</bdi> as spam? The chat is hidden, and future messages from this number go to Spam.
          </p>
          <div className="flex gap-2">
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => p.setConfirmSpam(false)}>Cancel</button>
            <button
              type="button"
              className={buttonClass("destructive", "sm")}
              onClick={() => {
                dispatch({ type: "spam", id: c.id, by: me, at: stamp() });
                p.setConfirmSpam(false);
              }}
            >
              Mark as spam
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid content-start gap-4 px-4 py-5">
          {pinned && (
            <div className="grid gap-1 rounded-[var(--radius-panel)] border border-primary bg-surface p-3">
              <p className="text-sm font-medium text-primary">
                Handoff note from {people.find((x) => x.id === pinned.fromId)?.name ?? "Someone"}
              </p>
              <p dir="auto">{pinned.note}</p>
            </div>
          )}
          {c.messages.map((m, i) => (
            <div key={m.id} id={i === c.messages.length - 1 ? `last-${c.id}` : undefined} className="grid">
              <MessageItem m={m} people={people} now={now} customer={c.contact.name.split(" ")[0]} />
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {p.handing && <HandoverPanel c={c} people={people} teams={teams} me={me} onClose={() => p.setHanding(false)} dispatch={dispatch} />}

      <Composer
        c={c}
        actions={actions}
        people={people}
        me={me}
        now={now}
        mode={p.mode}
        setMode={p.setMode}
        replyRef={p.replyRef}
        noteRef={p.noteRef}
        dispatch={dispatch}
      />
    </>
  );
}

function HandoverPanel({
  c,
  people,
  teams,
  me,
  onClose,
  dispatch,
}: {
  c: Conversation;
  people: Person[];
  teams: InboxData["teams"];
  me: string;
  onClose: () => void;
  dispatch: ThreadProps["dispatch"];
}) {
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  // Only real members who can reply; sample teammates can't take real chats.
  const targets = people.filter((x) => !x.sample && x.canReply && x.id !== c.holderId);
  const noteError = handoffNoteError(note);
  const toError = to ? null : "Choose who takes over.";

  function submit() {
    setTried(true);
    if (noteError || toError) return;
    const [kind, id] = to.split(":");
    dispatch({ type: "handover", id: c.id, by: me, toPerson: kind === "p" ? id : null, toTeam: kind === "t" ? id : null, note, at: stamp() });
    onClose();
  }

  const field = "w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-3 border-t border-border bg-surface px-4 py-3"
      aria-label="Hand over this chat"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="grid content-start gap-1">
          <label htmlFor={`ho-to-${c.id}`} className="text-sm font-medium">Hand over to</label>
          <select
            id={`ho-to-${c.id}`}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-invalid={tried && !!toError}
            aria-describedby={tried && toError ? `ho-to-err-${c.id}` : undefined}
            className={`${field} min-h-11`}
          >
            <option value="">Choose a person or team</option>
            {targets.length > 0 && (
              <optgroup label="People">
                {targets.map((x) => (
                  <option key={x.id} value={`p:${x.id}`}>{x.id === me ? `${x.name} (you)` : `${x.name}, ${x.role}`}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Teams (first to claim takes over)">
              {teams.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.name}</option>)}
            </optgroup>
          </select>
          {tried && toError && <p id={`ho-to-err-${c.id}`} role="alert" className="text-sm text-fail">{toError}</p>}
        </div>
        <div className="grid content-start gap-1">
          <label htmlFor={`ho-note-${c.id}`} className="text-sm font-medium">Why are you handing this over?</label>
          <textarea
            id={`ho-note-${c.id}`}
            rows={2}
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={tried && !!noteError}
            aria-describedby={`ho-note-help-${c.id}`}
            className={`${field} resize-y py-2`}
          />
          <p id={`ho-note-help-${c.id}`} role={tried && noteError ? "alert" : undefined} className={`text-sm ${tried && noteError ? "text-fail" : "text-muted"}`}>
            {tried && noteError ? noteError : "Required. Pinned at the top of the chat for the next person. The customer doesn't see it."}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonClass("ghost")}>Cancel</button>
        <button type="submit" className={buttonClass("primary")}>Hand over</button>
      </div>
    </form>
  );
}
