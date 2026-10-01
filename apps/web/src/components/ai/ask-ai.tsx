"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Lightning, Microphone, Sparkle, X } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { useFormat, useLocale, useT } from "@/i18n/client";
import type { AiWorld } from "@/lib/ai-sample";
import { AiTag } from "./ai-tag";
import { AiFeedback } from "./feedback";
import { addRecipe, spend, useAiState, type Recipe } from "./store";

/*
 * Ask AI (decided 2026-10-01): one panel on every screen, opened from the menu or ⌘K / Ctrl+K. People ask
 * questions, ask for work ("create follow-ups for…") and describe automations in their own words.
 * Work is always previewed and confirmed; automations become plain-language recipes with a test run.
 * In the preview the answers are scripted from the sample data; the real model reads the same things.
 */

const ASK_COST = 2;

type Intent = "quiet" | "tasks" | "recipe" | "today" | "unclaimed" | "ownerOnly" | "unknown";
type Turn = { id: number; who: "me" | "ai"; text?: string; intent?: Intent; recipe?: Recipe["key"] };

/** Words that point at each intent, in English and Arabic. The real assistant understands free text. */
const MATCH: [Intent | "recipeUrgent" | "recipeNight", RegExp][] = [
  ["ownerOnly", /billing|invoice|plan\b|subscription|disconnect|erase|delete (all|every)|فوتر|باقة|اشتراك|حذف/i],
  ["recipeUrgent", /(whenever|every time|automatic|always|rule|workflow|automation|أتمت|تلقائي|كلما).*(urgent|angry|complain|عاجل|غاضب|شكو)/i],
  ["recipeNight", /(whenever|every time|automatic|always|rule|workflow|automation|أتمت|تلقائي|كلما).*(night|after hours|closed|weekend|ليل|خارج|مغلق)/i],
  ["recipe", /whenever|every time|each time|automatic|automation|workflow|always|rule|أتمت|تلقائي|كلما|قاعدة/i],
  ["tasks", /(create|make|add|set up|أنشئ|أضف).*(task|follow|reminder|مهام|مهمة|متابع)/i],
  ["quiet", /quiet|stall|stuck|silent|no reply|haven'?t replied|ghost|متوقف|لم يرد|بلا رد|صامت/i],
  ["unclaimed", /unclaimed|waiting|nobody|no one|غير مسند|ينتظر|بانتظار/i],
  ["today", /today|brief|summar|morning|what('?s| is) (up|new|due)|اليوم|ملخص|موجز/i],
];

function classify(text: string): { intent: Intent; recipe?: Recipe["key"] } {
  for (const [k, re] of MATCH) {
    if (!re.test(text)) continue;
    if (k === "recipeUrgent") return { intent: "recipe", recipe: "urgentRoute" };
    if (k === "recipeNight") return { intent: "recipe", recipe: "afterHours" };
    if (k === "recipe") return { intent: "recipe", recipe: "quietQuote" };
    return { intent: k };
  }
  return { intent: "unknown" };
}

/** Which screen the person is on, so answers can start from it. */
function screenOf(path: string, base: string) {
  const rest = path.slice(base.length).split("/")[1] ?? "";
  return (["inbox", "customers", "deals", "tasks"] as const).find((s) => s === rest) ?? (rest ? "settings" : "home");
}

export function AskAi({ world, open, onClose }: { world: AiWorld | null; open: boolean; onClose: () => void }) {
  const t = useT("ai");
  const tAll = useT();
  const path = usePathname();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const locale = useLocale();
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  /**
   * Hold-free voice input (decided 2026-10-01: at launch). The preview uses the browser's own speech
   * recognition where it exists; the real app sends audio to the transcription model (+1 credit).
   */
  function listen() {
    type Rec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void };
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceNote(t("voiceUnsupported"));
      return;
    }
    const rec = new Ctor();
    rec.lang = locale === "ar" ? "ar-AE" : "en-GB";
    rec.interimResults = true;
    rec.onresult = (e) => setText(Array.from(e.results).map((r) => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setVoiceNote(t("voiceError"));
    };
    setVoiceNote(null);
    setListening(true);
    spend(1);
    rec.start();
  }
  const { spent } = useAiState();

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, thinking]);

  if (!open) return null;
  const screen = world ? screenOf(path, world.base) : "home";

  function ask(q: string) {
    const question = q.trim();
    if (!question || !world || thinking) return;
    const { intent, recipe } = classify(question);
    const id = (seq.current += 2);
    setTurns((ts) => [...ts, { id, who: "me", text: question }]);
    setText("");
    setThinking(true);
    spend(ASK_COST);
    // A short pause, so the scripted answer reads like the real one will arrive.
    window.setTimeout(() => {
      setTurns((ts) => [...ts, { id: id + 1, who: "ai", intent, recipe }]);
      setThinking(false);
    }, 650);
  }

  const suggestions: string[] = !world
    ? []
    : [
        ...(world.canDeals ? [t("prompts.quiet")] : []),
        t("prompts.today"),
        ...(world.canTasks && world.canDeals ? [t("prompts.tasks")] : []),
        ...(world.canDeals ? [t("prompts.recipe")] : [t("prompts.recipeUrgent")]),
      ];

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label={tAll("common.close")} onClick={onClose} className="absolute inset-0 bg-black/30" />
      <aside role="dialog" aria-modal="true" aria-label={t("title")} className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-surface shadow-[var(--shadow-2)]">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="grid">
            <h2 className="flex items-center gap-2 font-semibold">
              <Sparkle size={18} weight="fill" className="text-ai" aria-hidden="true" /> {t("title")}
            </h2>
            {world && (
              <p className="text-xs text-muted">
                {t("context", { screen: t(`screens.${screen}`) })} · {t("creditsLeft", { left: Math.max(0, world.credits.left - spent), total: world.credits.total })}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className={buttonClass("ghost", "sm", "!px-2")} aria-label={tAll("common.close")} title={tAll("panel.closeTitle")}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!world ? (
            <p className="rounded-[var(--radius-panel)] bg-surface-2 p-4 text-sm text-muted">{t("notYet")}</p>
          ) : turns.length === 0 ? (
            <div className="grid gap-4">
              <p className="text-muted">{t("intro", { name: world.me.name })}</p>
              <ul className="grid gap-2">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => ask(s)} className="w-full rounded-[var(--radius-control)] border border-border px-3 py-2.5 text-start text-sm hover:border-ai hover:bg-ai-soft">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">{t("limits")}</p>
            </div>
          ) : (
            <ol className="grid gap-4">
              {turns.map((turn) =>
                turn.who === "me" ? (
                  <li key={turn.id} className="max-w-[85%] justify-self-end rounded-[var(--radius-panel)] bg-primary-soft px-3.5 py-2.5" dir="auto">{turn.text}</li>
                ) : (
                  <li key={turn.id} className="grid gap-2">
                    <span className="flex items-center justify-between gap-2"><AiTag /><AiFeedback /></span>
                    <Answer intent={turn.intent!} recipe={turn.recipe} world={world} onAsk={ask} onNavigate={onClose} />
                  </li>
                ),
              )}
              {thinking && (
                <li className="flex items-center gap-2 text-sm text-muted" role="status">
                  <Sparkle size={16} className="animate-pulse text-ai" aria-hidden="true" /> {t("thinking")}
                </li>
              )}
            </ol>
          )}
          <div ref={endRef} />
        </div>

        {world && (
          <form
            className="grid gap-1.5 border-t border-border px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
          >
            <label htmlFor="ask-ai" className="sr-only">{t("inputLabel")}</label>
            <div className="flex items-end gap-2 rounded-[var(--radius-panel)] border border-input bg-surface px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
              <textarea
                id="ask-ai"
                ref={inputRef}
                rows={2}
                dir="auto"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(text);
                  }
                }}
                placeholder={t("placeholder")}
                className="min-w-0 flex-1 resize-none bg-transparent text-base placeholder:text-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={listen}
                aria-pressed={listening}
                className={`grid size-9 shrink-0 place-items-center rounded-full ${listening ? "animate-pulse bg-fail text-white" : "text-ai hover:bg-ai-soft"}`}
                aria-label={listening ? t("listening") : t("voice")}
                title={listening ? t("listening") : t("voice")}
              >
                <Microphone size={18} weight={listening ? "fill" : "regular"} aria-hidden="true" />
              </button>
              <button type="submit" disabled={!text.trim() || thinking} className="grid size-9 shrink-0 place-items-center rounded-full bg-ai text-white disabled:opacity-40" aria-label={t("send")}>
                <ArrowUp size={18} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-muted" role={voiceNote ? "status" : undefined}>{voiceNote ?? (listening ? t("listening") : t("footer", { count: ASK_COST }))}</p>
          </form>
        )}
      </aside>
    </div>
  );
}

/** One scripted answer. Every list links to the real record; every change waits for a click. */
function Answer({ intent, recipe, world, onAsk, onNavigate }: { intent: Intent; recipe?: Recipe["key"]; world: AiWorld; onAsk: (q: string) => void; onNavigate: () => void }) {
  const t = useT("ai");
  const fmt = useFormat();
  const p = "text-sm leading-relaxed";

  if (intent === "ownerOnly") return <p className={p}>{t("answers.ownerOnly")}</p>;

  if ((intent === "quiet" || intent === "tasks") && !world.canDeals) return <p className={p}>{t("answers.noDeals")}</p>;

  if (intent === "quiet") {
    if (world.quietDeals.length === 0) return <p className={p}>{t("answers.quietNone")}</p>;
    return (
      <div className="grid gap-2">
        <p className={p}>{t("answers.quiet", { count: world.quietDeals.length })}</p>
        <ul className="grid gap-1.5">
          {world.quietDeals.map((d) => (
            <li key={d.id}>
              <Link href={`${world.base}/deals?deal=${d.id}`} onClick={onNavigate} className="grid rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm hover:bg-surface-2">
                <span className="flex justify-between gap-2 font-medium"><bdi>{d.customer}</bdi>{d.fils !== null && <span className="tabular-nums text-muted">{fmt.aed(d.fils)}</span>}</span>
                <span className="text-muted">{t("answers.quietRow", { title: d.title, days: d.quietDays, owner: d.owner })}</span>
              </Link>
            </li>
          ))}
        </ul>
        {world.canTasks && <button type="button" onClick={() => onAsk(t("prompts.tasks"))} className={buttonClass("secondary", "sm", "w-fit")}>{t("answers.makeTasks")}</button>}
      </div>
    );
  }

  if (intent === "tasks") {
    if (!world.canTasks) return <p className={p}>{t("answers.noTasks")}</p>;
    return <TaskPreview world={world} />;
  }

  if (intent === "recipe") return <RecipeCard recipeKey={recipe ?? "quietQuote"} world={world} />;

  if (intent === "unclaimed") {
    if (world.unclaimed.length === 0) return <p className={p}>{t("answers.unclaimedNone")}</p>;
    return (
      <div className="grid gap-2">
        <p className={p}>{t("answers.unclaimed", { count: world.unclaimed.length })}</p>
        <ul className="grid gap-1.5">
          {world.unclaimed.map((c) => (
            <li key={c.id}>
              <Link href={`${world.base}/inbox?c=${c.id}`} onClick={onNavigate} className="flex justify-between gap-2 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm hover:bg-surface-2">
                <bdi className="font-medium">{c.customer}</bdi>
                <span className="text-muted">{fmt.minutesWaited(c.waitingMin)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (intent === "today") {
    return (
      <div className="grid gap-2 text-sm">
        <p className={p}>{t("answers.today", { name: world.me.name })}</p>
        <ul className="grid list-disc gap-1 ps-5">
          <li>{t("answers.todayTasks", { count: world.tasksToday.length })}{world.tasksToday.length > 0 && <>: <bdi>{world.tasksToday.map((x) => x.text).join(", ")}</bdi></>}</li>
          {world.overdue.length > 0 && <li className="text-warn">{t("answers.todayOverdue", { count: world.overdue.length })}</li>}
          <li>{t("answers.todayUnclaimed", { count: world.unclaimed.length })}</li>
          {world.canDeals && <li>{t("answers.todayQuiet", { count: world.quietDeals.length })}</li>}
        </ul>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <p className={p}>{t("answers.unknown")}</p>
      <div className="flex flex-wrap gap-1.5">
        {[t("prompts.today"), ...(world.canDeals ? [t("prompts.quiet")] : []), t("prompts.recipeUrgent")].map((s) => (
          <button key={s} type="button" onClick={() => onAsk(s)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-ai-soft">{s}</button>
        ))}
      </div>
    </div>
  );
}

/** "Create 3 follow-up tasks": the exact changes, each with a checkbox, and nothing happens until Do it. */
function TaskPreview({ world }: { world: AiWorld }) {
  const t = useT("ai");
  const [picked, setPicked] = useState(() => new Set(world.quietDeals.map((d) => d.id)));
  const [state, setState] = useState<"preview" | "done" | "undone">("preview");
  if (world.quietDeals.length === 0) return <p className="text-sm">{t("answers.quietNone")}</p>;
  const n = picked.size;

  if (state === "done") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-done-soft px-3 py-2 text-sm">
        <span className="flex items-center gap-1.5"><Check size={16} aria-hidden="true" /> {t("tasksDone", { count: n })}</span>
        <button type="button" onClick={() => setState("undone")} className="font-medium underline-offset-2 hover:underline">{t("undo")}</button>
      </div>
    );
  }
  if (state === "undone") return <p className="text-sm text-muted">{t("tasksUndone")}</p>;

  return (
    <div className="grid gap-2 rounded-[var(--radius-panel)] border border-ai/40 bg-ai-soft/40 p-3">
      <p className="text-sm font-medium">{t("tasksPreview", { count: world.quietDeals.length })}</p>
      <ul className="grid gap-1">
        {world.quietDeals.map((d) => (
          <li key={d.id}>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={picked.has(d.id)}
                onChange={() => setPicked((s) => { const x = new Set(s); if (x.has(d.id)) x.delete(d.id); else x.add(d.id); return x; })}
                className="mt-1 size-4 accent-[var(--ai)]"
              />
              <span>{t("taskLine", { customer: d.customer, owner: d.owner })}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{t("tasksNote")}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setState("undone")} className={buttonClass("ghost", "sm")}>{t("notNow")}</button>
        <button type="button" disabled={n === 0} onClick={() => setState("done")} className={buttonClass("primary", "sm")}>{t("doIt", { count: n })}</button>
      </div>
    </div>
  );
}

/** A plain-language automation: When / Only if / Then, a test run on last week, then Turn on. */
function RecipeCard({ recipeKey, world }: { recipeKey: Recipe["key"]; world: AiWorld }) {
  const t = useT("ai");
  const { recipes } = useAiState();
  const [days, setDays] = useState(3);
  const [tested, setTested] = useState(false);
  const on = recipes.some((r) => r.key === recipeKey && r.on);
  const hits = recipeKey === "quietQuote" ? world.quietDeals.filter((d) => d.quietDays >= days).map((d) => d.customer) : recipeKey === "urgentRoute" ? ["Rahul Menon"] : ["Deepak Nair", "George Mathew"];
  const steps = ["when", "if", "then"] as const;

  return (
    <div className="grid gap-3 rounded-[var(--radius-panel)] border border-ai/40 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Lightning size={16} weight="fill" className="text-ai" aria-hidden="true" /> {t(`recipes.${recipeKey}.name`)}</p>
      <dl className="grid gap-2 text-sm">
        {steps.map((s) => (
          <div key={s} className="grid grid-cols-[4.5rem_1fr] gap-2">
            <dt className="text-xs font-medium uppercase text-muted">{t(`recipeSteps.${s}`)}</dt>
            <dd>
              {recipeKey === "quietQuote" && s === "when" ? (
                <>
                  {t("recipes.quietQuote.whenBefore")}{" "}
                  <select value={days} onChange={(e) => { setDays(Number(e.target.value)); setTested(false); }} aria-label={t("recipeDays")} className="rounded-full border border-input bg-surface px-2 py-0.5 text-sm">
                    {[2, 3, 5, 7].map((d) => <option key={d} value={d}>{t("days", { count: d })}</option>)}
                  </select>
                </>
              ) : (
                t(`recipes.${recipeKey}.${s}`)
              )}
            </dd>
          </div>
        ))}
      </dl>
      {tested ? (
        <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm">
          {hits.length ? t("testHits", { count: hits.length, names: hits.join(", ") }) : t("testNone")}
        </p>
      ) : null}
      {on ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-done">
          <Check size={16} aria-hidden="true" /> {t("recipeOn")}{" "}
          <Link href={`${world.base}/ai`} className="text-primary underline-offset-2 hover:underline">{t("seeInSettings")}</Link>
        </p>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setTested(true)} className={buttonClass("secondary", "sm")}>{t("testRun")}</button>
          <button type="button" onClick={() => addRecipe(recipeKey)} className={buttonClass("primary", "sm")}>{t("turnOn")}</button>
        </div>
      )}
    </div>
  );
}
