"use client";

import { Fragment, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CaretDown, ChatsCircle, DotsThree, EnvelopeSimple, MagnifyingGlass, SidebarSimple, X } from "@phosphor-icons/react";
import { HANDOFF_NOTE_MIN, conversationActions, handoffNoteError, replyAccess, windowOpen, type Viewer } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { Composer, type ComposerMode } from "./composer";
import { CustomerPanel } from "./customer-panel";
import { useFormat, useT } from "@/i18n/client";
import { roleLabel } from "@/i18n/labels";
import type { Format, TFor, Translator } from "@/i18n/types";
import { MessageItem, mediaLabel } from "./message";
import { lastActivity, reducer, stamp, type InboxAction } from "./store";
import type { Conversation, InboxData, Message, Person } from "./types";

type Filter = "mine" | "teams" | "unassigned" | "all" | "spam";
const REPLY_TARGET_MIN = 30;
const GROUP_MS = 5 * 60_000;

const VIEWS: Filter[] = ["mine", "teams", "unassigned", "all", "spam"];

/* Keys stay Latin letters in Arabic too: they're the physical keys. */
const SHORTCUTS: [string, keyof typeof import("@/i18n/messages/en").en.inbox.shortcuts][] = [
  ["J / K", "next"],
  ["R", "reply"],
  ["N", "note"],
  ["H", "handover"],
  ["E", "resolve"],
  ["/", "search"],
  ["Esc", "close"],
  ["?", "help"],
];

function lastReal(c: Conversation) {
  const real = c.messages.filter((m) => m.kind !== "event");
  return real[real.length - 1];
}

/** Only states that need someone get a label in the list (decided 2026-09-30). */
function attention(c: Conversation, now: number, t: TFor<"inbox">, fmt: Format): { label: string; tone: "warn" | "fail" } | null {
  if (c.status !== "open") return null;
  const last = lastReal(c);
  if (last?.status === "failed") return { label: t("flags.notDelivered"), tone: "fail" };
  if (!c.holderId && last?.kind === "in" && c.lastCustomerAt !== null && now - c.lastCustomerAt > REPLY_TARGET_MIN * 60_000) {
    return { label: t("flags.waiting", { time: fmt.waitedFor(c.lastCustomerAt, now) }), tone: "warn" };
  }
  if (c.channel === "whatsapp" && c.holderId && !windowOpen(c.lastCustomerAt, now)) return { label: t("flags.windowClosed"), tone: "warn" };
  return null;
}

function snippet(c: Conversation, people: Person[], me: string, tAll: Translator) {
  const m = lastReal(c);
  if (!m) return "";
  const body = m.deleted ? tAll("inbox.snippet.deleted") : m.subject ?? m.text ?? (m.media ? mediaLabel(m.media, tAll) : "");
  if (m.kind === "note") return tAll("inbox.snippet.note", { body });
  if (m.kind === "out") return tAll("inbox.snippet.by", { name: m.authorId === me ? tAll("common.you") : people.find((p) => p.id === m.authorId)?.name ?? tAll("common.team"), body });
  return body;
}

/** Who has held the chat, in order; the last one can reply now. */
function Trail({ ids, people }: { ids: string[]; people: Person[] }) {
  const t = useT("inbox");
  const common = useT("common");
  return (
    <span className="inline-flex min-w-0 items-center gap-1" aria-label={t("trail")}>
      {ids.map((id, i) => (
        <Fragment key={`${id}-${i}`}>
          {i > 0 && <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>}
          <span className={i === ids.length - 1 ? "font-medium text-primary" : ""}>{people.find((x) => x.id === id)?.name ?? common("someone")}</span>
        </Fragment>
      ))}
    </span>
  );
}

export function Inbox({ data }: { data: InboxData }) {
  const { now, people, teams } = data;
  const viewer: Viewer = data.viewer;
  const me = viewer.memberId;
  const [conversations, dispatch] = useReducer(useMemo(() => reducer(), []), data.conversations);

  const params = useSearchParams();
  const selectedId = params.get("c");
  const [filter, setFilter] = useState<Filter>("mine");
  const [showResolved, setShowResolved] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<ComposerMode>("reply");
  const [handing, setHanding] = useState(false);
  const [confirmSpam, setConfirmSpam] = useState(false);
  // The customer panel stays open or closed across chats until the person changes it.
  const [panelOpen, setPanelOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [sampleNote, setSampleNote] = useState(true);

  const t = useT("inbox");
  const tAll = useT();
  const fmt = useFormat();
  const searchRef = useRef<HTMLInputElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const canSeeAll = viewer.scopes["conversations.view"] === "all";
  const views = VIEWS.filter((f) => f !== "all" || canSeeAll);
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
          [t("groups.yours"), list.filter(isMine)],
          [t("groups.waiting"), list.filter((c) => !isMine(c))],
        ]
      : [[null, list]];
  const ordered = groups.flatMap(([, g]) => g);

  const selected = visible.find((c) => c.id === selectedId) ?? null;
  const actions = selected ? conversationActions(viewer, selected) : null;

  function select(id: string | null) {
    setHanding(false);
    setConfirmSpam(false);
    setMode("reply");
    if (id) dispatch({ type: "open", id });
    // Native history keeps the chat in the URL (shareable, Back returns to the list) without a server round trip.
    window.history.pushState(null, "", id ? `?c=${id}` : window.location.pathname);
  }

  function toggleResolve() {
    if (!selected || !actions?.canResolve) return;
    dispatch({ type: selected.status === "resolved" ? "reopen" : "resolve", id: selected.id, by: me, at: stamp() });
  }

  function openSearch() {
    setSearching(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t.closest("input, textarea, select, [contenteditable=true]");
      if (e.key === "Escape") {
        if (handing || confirmSpam || help) {
          setHanding(false);
          setConfirmSpam(false);
          setHelp(false);
        } else setPanelOpen(false);
        if (typing) t.blur();
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
          openSearch();
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

  const currentLabel = t(`views.${filter}`);

  return (
    <div className={`grid h-full min-h-0 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] ${selected && panelOpen ? "xl:grid-cols-[320px_minmax(0,1fr)_320px]" : ""}`}>
      {/* Conversation list */}
      <section aria-label={t("conversations")} className={`${selected ? "hidden md:flex" : "flex"} relative min-h-0 flex-col border-e border-border bg-surface`}>
        <h1 className="sr-only">{t("title")}</h1>
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border ps-4 pe-2">
          <label className="relative flex min-w-0 items-center">
            <span className="sr-only">{t("view")}</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="title min-h-11 max-w-full cursor-pointer appearance-none truncate bg-transparent pe-6 text-xl [field-sizing:content] focus-visible:outline-offset-4"
            >
              {views.map((f) => (
                <option key={f} value={f}>{t("viewCount", { view: t(`views.${f}`), count: openCount(f) })}</option>
              ))}
            </select>
            <CaretDown size={16} className="pointer-events-none absolute end-0 text-muted" aria-hidden="true" />
            <span className="sr-only">{t("showing", { view: currentLabel })}</span>
          </label>
          <div className="ms-auto flex items-center gap-1">
            {filter !== "spam" && (
              <div role="group" aria-label={t("status")} className="inline-flex rounded-full bg-surface-2 p-0.5 text-sm">
                {[false, true].map((r) => (
                  <button
                    key={String(r)}
                    type="button"
                    aria-pressed={showResolved === r}
                    onClick={() => setShowResolved(r)}
                    className={`min-h-8 rounded-full px-3 font-medium transition-colors ${showResolved === r ? "bg-surface text-text shadow-[var(--shadow-1)]" : "text-muted hover:text-text"}`}
                  >
                    {r ? t("resolved") : t("open")}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => (searching ? (setSearching(false), setQuery("")) : openSearch())}
              aria-expanded={searching}
              aria-label={searching ? t("searchClose") : t("searchOpen")}
              title={t("searchTitle")}
              className={buttonClass("ghost", "sm", "!px-2.5 text-text")}
            >
              {searching ? <X size={20} aria-hidden="true" /> : <MagnifyingGlass size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {searching && (
          <div className="border-b border-border p-2">
            <label className="sr-only" htmlFor="inbox-search">{t("searchLabel")}</label>
            <input
              id="inbox-search"
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="min-h-10 w-full rounded-full border border-input bg-surface px-4 text-sm placeholder:text-muted"
            />
          </div>
        )}

        {help && (
          <div className="absolute inset-x-2 top-16 z-10 rounded-[var(--radius-panel)] border border-border bg-surface p-4 shadow-[var(--shadow-2)]">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{t("shortcutsTitle")}</p>
              <button type="button" onClick={() => setHelp(false)} className={buttonClass("ghost", "sm", "!px-2")} aria-label={t("shortcutsClose")}><X size={18} aria-hidden="true" /></button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              {SHORTCUTS.map(([k, d]) => (
                <div key={k} className="contents">
                  <dt><kbd dir="ltr" className="rounded border border-border bg-surface-2 px-1.5 text-xs">{k}</kbd></dt>
                  <dd className="text-muted">{t(`shortcuts.${d}`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {ordered.length === 0 ? (
            <p className="p-8 text-center text-muted">
              {query ? t("empty.search") : filter === "mine" ? t("empty.mine") : filter === "spam" ? t("empty.spam") : t("empty.other")}
            </p>
          ) : (
            groups.map(([title, g]) =>
              g.length === 0 ? null : (
                <div key={title ?? "all"}>
                  {title && <h2 className="px-4 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-muted">{title}</h2>}
                  <ul className="px-2 pb-1">
                    {g.map((c) => {
                      const flag = attention(c, now, t, fmt);
                      const on = c.id === selectedId;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => select(c.id)}
                            aria-current={on ? "true" : undefined}
                            className={`grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-0.5 rounded-[var(--radius-control)] px-3 py-2.5 text-start transition-colors ${on ? "bg-primary-soft" : "hover:bg-surface-2"}`}
                          >
                            <span className="flex items-baseline justify-between gap-3">
                              <span className={`flex min-w-0 items-center gap-1.5 ${c.unread ? "font-semibold" : "font-medium"}`}>
                                {c.channel === "email" && <EnvelopeSimple size={16} className="shrink-0 text-muted" aria-label={t("email")} />}
                                <bdi className="truncate">{c.contact.name}</bdi>
                              </span>
                              <span className={`shrink-0 text-xs tabular-nums ${c.unread ? "font-semibold text-primary" : "text-muted"}`}>{fmt.listTime(lastActivity(c), now)}</span>
                            </span>
                            <span className="flex items-center justify-between gap-3">
                              <span className="truncate text-sm text-muted" dir="auto">{snippet(c, people, me, tAll)}</span>
                              <span className="flex shrink-0 items-center gap-2">
                                {flag && (
                                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${flag.tone === "fail" ? "text-fail" : "text-warn"}`}>
                                    <span aria-hidden="true" className={`size-1.5 rounded-full ${flag.tone === "fail" ? "bg-fail" : "bg-warn"}`} />
                                    {flag.label}
                                  </span>
                                )}
                                {c.unread > 0 && (
                                  <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-semibold leading-5 text-on-primary" aria-label={t("unread", { count: c.unread })}>{c.unread}</span>
                                )}
                              </span>
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

        {sampleNote && (
          <p className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted">
            <span>{t("sampleNote")}</span>
            <button type="button" onClick={() => setSampleNote(false)} className="min-h-8 shrink-0 font-medium text-primary hover:underline">{tAll("common.dismiss")}</button>
          </p>
        )}
      </section>

      {/* Thread */}
      <section aria-label={t("conversation")} className={`${selected ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col bg-bg`}>
        {!selected || !actions ? (
          <div className="grid flex-1 place-content-center justify-items-center gap-3 p-8 text-center text-muted">
            <ChatsCircle size={44} weight="light" aria-hidden="true" />
            <p>{t("choose")}</p>
            <p className="hidden text-sm md:block">
              {t.rich("chooseHint", {
                j: <kbd className="rounded border border-border bg-surface px-1.5 text-xs">J</kbd>,
                help: <kbd className="rounded border border-border bg-surface px-1.5 text-xs">?</kbd>,
              })}
            </p>
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
            panelOpen={panelOpen}
            onBack={() => select(null)}
            onTogglePanel={() => setPanelOpen((o) => !o)}
            onToggleResolve={toggleResolve}
            replyRef={replyRef}
            noteRef={noteRef}
            dispatch={dispatch}
          />
        )}
      </section>

      {/* Customer panel: closed by default; a column from 1280px, a sheet below that. */}
      {selected && panelOpen && (
        <>
          <aside aria-label={t("customer")} className="hidden min-h-0 overflow-y-auto border-s border-border bg-surface xl:block">
            <CustomerPanel c={selected} people={people} teams={teams} viewer={viewer} now={now} dispatch={dispatch} onClose={() => setPanelOpen(false)} />
          </aside>
          <div className="fixed inset-0 z-40 xl:hidden">
            <button type="button" aria-label={t("closeCustomerDetails")} onClick={() => setPanelOpen(false)} className="absolute inset-0 bg-black/40" />
            <aside aria-label={t("customer")} className="absolute inset-y-0 end-0 w-full max-w-sm overflow-y-auto bg-surface shadow-[var(--shadow-2)]">
              <CustomerPanel c={selected} people={people} teams={teams} viewer={viewer} now={now} dispatch={dispatch} onClose={() => setPanelOpen(false)} />
            </aside>
          </div>
        </>
      )}
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
  panelOpen: boolean;
  onBack: () => void;
  onTogglePanel: () => void;
  onToggleResolve: () => void;
  replyRef: React.RefObject<HTMLTextAreaElement | null>;
  noteRef: React.RefObject<HTMLTextAreaElement | null>;
  dispatch: (a: InboxAction) => void;
}

/** Two messages belong to one run when the same sender wrote them within 5 minutes on the same day. */
function sameRun(a: Message | undefined, b: Message | undefined, sameDay: Format["sameDay"]) {
  if (!a || !b || a.kind === "event" || b.kind === "event" || a.kind !== b.kind) return false;
  return (a.kind === "in" || a.authorId === b.authorId) && a.source === b.source && Math.abs(b.at - a.at) <= GROUP_MS && sameDay(a.at, b.at);
}

function Thread(p: ThreadProps) {
  const { c, actions, people, teams, viewer, now, dispatch } = p;
  const me = viewer.memberId;
  const team = teams.find((t) => t.id === c.teamId);
  const pinned = c.handoffs[c.handoffs.length - 1];
  const endRef = useRef<HTMLDivElement>(null);
  const count = c.messages.length;
  const first = c.contact.name.split(" ")[0];
  const t = useT("inbox");
  const common = useT("common");
  const fmt = useFormat();
  const { sameDay } = fmt;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface ps-2 pe-2 md:ps-5">
        <div className="flex min-w-0 items-center gap-1">
          <button type="button" onClick={p.onBack} className={buttonClass("ghost", "sm", "!px-2 md:hidden")} aria-label={t("back")}>
            <ArrowLeft size={20} className="rtl:rotate-180" aria-hidden="true" />
          </button>
          <div className="grid min-w-0 leading-tight">
            <h2 className="flex min-w-0 items-center gap-2 font-semibold">
              <bdi className="truncate">{c.contact.name}</bdi>
              {c.channel === "email" && <span className="shrink-0 text-xs font-normal text-muted">{t("outlook")}</span>}
              {c.imported && <Badge>{t("imported")}</Badge>}
              {c.status === "resolved" && <Badge tone="done">{t("resolved")}</Badge>}
              {c.status === "spam" && <Badge tone="fail">{t("spam")}</Badge>}
            </h2>
            <p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted">
              {c.trail.length > 0 ? <Trail ids={c.trail} people={people} /> : <span>{c.imported ? t("importedFromPhone") : t("unassigned")}</span>}
              {team && <span className="truncate">· {team.name}</span>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {actions.canHandOver && c.status !== "spam" && (
            <button type="button" onClick={() => p.setHanding(!p.handing)} aria-expanded={p.handing} className={buttonClass("secondary", "sm")} title={t("handOverTitle")}>
              {t("handOver")}
            </button>
          )}
          {actions.canResolve && c.status !== "spam" && (
            <button type="button" onClick={p.onToggleResolve} className={buttonClass("ghost", "sm", "hidden lg:inline-flex")} title={t("withKey", { action: c.status === "resolved" ? t("reopen") : t("resolve") })}>
              {c.status === "resolved" ? t("reopen") : t("resolve")}
            </button>
          )}
          <button
            type="button"
            onClick={p.onTogglePanel}
            aria-pressed={p.panelOpen}
            className={buttonClass("ghost", "sm", `!px-2.5 ${p.panelOpen ? "bg-primary-soft" : ""}`)}
            title={t("customerDetails")}
            aria-label={t("customerDetails")}
          >
            <SidebarSimple size={20} className="rotate-180 rtl:rotate-0" aria-hidden="true" />
          </button>
          {(actions.canMarkSpam || actions.canResolve) && (
            <details className="relative">
              <summary className={buttonClass("ghost", "sm", "!px-2 list-none [&::-webkit-details-marker]:hidden")} aria-label={common("moreActions")}>
                <DotsThree size={22} weight="bold" aria-hidden="true" />
              </summary>
              <div className="absolute end-0 top-full z-20 mt-1 grid min-w-48 rounded-[var(--radius-control)] border border-border bg-surface p-1 shadow-[var(--shadow-2)]">
                {actions.canResolve && c.status !== "spam" && (
                  <button type="button" onClick={p.onToggleResolve} className="min-h-11 rounded px-3 text-start hover:bg-surface-2 lg:hidden">
                    {c.status === "resolved" ? t("reopen") : t("resolve")}
                  </button>
                )}
                {actions.canMarkSpam &&
                  (c.status === "spam" ? (
                    <button type="button" onClick={() => dispatch({ type: "notSpam", id: c.id, by: me, at: stamp() })} className="min-h-11 rounded px-3 text-start hover:bg-surface-2">
                      {t("notSpam")}
                    </button>
                  ) : (
                    <button type="button" onClick={() => p.setConfirmSpam(true)} className="min-h-11 rounded px-3 text-start text-fail hover:bg-surface-2">
                      {t("markSpamMenu")}
                    </button>
                  ))}
              </div>
            </details>
          )}
        </div>
      </header>

      {p.confirmSpam && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-fail-soft px-5 py-3">
          <p className="text-sm">
            {t.rich("markSpamConfirm", { name: <bdi className="font-semibold">{c.contact.name}</bdi> })}
          </p>
          <div className="flex gap-2">
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => p.setConfirmSpam(false)}>{common("cancel")}</button>
            <button
              type="button"
              className={buttonClass("destructive", "sm")}
              onClick={() => {
                dispatch({ type: "spam", id: c.id, by: me, at: stamp() });
                p.setConfirmSpam(false);
              }}
            >
              {t("markSpam")}
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-3xl content-start px-4 py-6 md:px-6">
          {pinned && (
            <div className="mb-6 grid gap-1 rounded-[var(--radius-panel)] bg-surface p-4 shadow-[var(--shadow-1)]">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                {t("handoffNote", { name: people.find((x) => x.id === pinned.fromId)?.name ?? common("someone") })}
              </p>
              <p dir="auto">{pinned.note}</p>
            </div>
          )}
          {c.messages.map((m, i) => {
            const prev = c.messages[i - 1];
            const next = c.messages[i + 1];
            const newDay = !prev || !sameDay(prev.at, m.at);
            const joined = !newDay && sameRun(prev, m, sameDay);
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="my-4 flex items-center gap-3 text-xs font-medium text-muted" role="separator" aria-label={fmt.dayLabel(m.at, now)}>
                    <span className="h-px flex-1 bg-border" />
                    {fmt.dayLabel(m.at, now)}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div id={i === c.messages.length - 1 ? `last-${c.id}` : undefined} className={`grid ${newDay ? "" : joined ? "mt-1" : "mt-4"}`}>
                  <MessageItem m={m} people={people} teams={teams} customer={first} first={!joined} last={!sameRun(m, next, sameDay) || (!!next && !sameDay(m.at, next.at))} />
                </div>
              </Fragment>
            );
          })}
          <div ref={endRef} className="h-2" />
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
  const t = useT("handover");
  const tAll = useT();
  const common = useT("common");
  const noteError = handoffNoteError(note) ? t("noteTooShort", { min: HANDOFF_NOTE_MIN }) : null;
  const toError = to ? null : t("chooseError");

  function submit() {
    setTried(true);
    if (noteError || toError) return;
    const [kind, id] = to.split(":");
    dispatch({ type: "handover", id: c.id, by: me, toPerson: kind === "p" ? id : null, toTeam: kind === "t" ? id : null, note, at: stamp() });
    onClose();
  }

  const field = "w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base";

  return (
    <div className="px-3 md:px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mx-auto grid w-full max-w-3xl gap-3 rounded-[var(--radius-panel)] border border-border bg-surface p-4 shadow-[var(--shadow-2)]"
        aria-label={t("form")}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
          <div className="grid content-start gap-1">
            <label htmlFor={`ho-to-${c.id}`} className="text-sm font-medium">{t("to")}</label>
            <select
              id={`ho-to-${c.id}`}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-invalid={tried && !!toError}
              aria-describedby={tried && toError ? `ho-to-err-${c.id}` : undefined}
              className={`${field} min-h-11`}
            >
              <option value="">{t("choose")}</option>
              {targets.length > 0 && (
                <optgroup label={t("people")}>
                  {targets.map((x) => (
                    <option key={x.id} value={`p:${x.id}`}>{x.id === me ? common("youSuffix", { name: x.name }) : common("nameRole", { name: x.name, role: roleLabel(tAll, x.role) })}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t("teams")}>
                {teams.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.name}</option>)}
              </optgroup>
            </select>
            {tried && toError && <p id={`ho-to-err-${c.id}`} role="alert" className="text-sm text-fail">{toError}</p>}
          </div>
          <div className="grid content-start gap-1">
            <label htmlFor={`ho-note-${c.id}`} className="text-sm font-medium">{t("why")}</label>
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
              {tried && noteError ? noteError : t("help")}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass("ghost", "sm")}>{common("cancel")}</button>
          <button type="submit" className={buttonClass("primary", "sm")}>{t("submit")}</button>
        </div>
      </form>
    </div>
  );
}
