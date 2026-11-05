"use client";

import { useState } from "react";
import { ArrowRight, Lock } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n/client";

/*
 * A real, working miniature of the inbox handoff (sample data, runs in the browser).
 * Used on the landing page and, with `full`, on /demo. Replaced by product screenshots
 * only where a static image says it better.
 */

type Msg = { kind: "in" | "out" | "event" | "note"; text: string; who?: string; to?: string; time?: string };
/** Role template per sample person; the role's name comes from the language files. */
const PEOPLE: Record<string, "agent" | "sales_manager" | "ops_manager"> = { Hana: "agent", Sara: "sales_manager", Priya: "ops_manager" };

const START: Msg[] = [
  { kind: "in", text: "Hi, do you have the ThinkPad E14 in stock? I need 12 for my office.", time: "09:02" },
  { kind: "out", text: "Hello Mariam, yes, we have 12 in stock. I'll send you a quote now.", who: "Hana", time: "09:05" },
  { kind: "in", text: "Can you do 10% off for 12 units?", time: "09:24" },
];

/** `fixed` locks the height (landing page), so opening the form scrolls inside the card instead of growing it. */
export function HandoffDemo({ full = false, fixed = false }: { full?: boolean; fixed?: boolean }) {
  const [trail, setTrail] = useState<string[]>(["Hana"]);
  const [msgs, setMsgs] = useState<Msg[]>(START);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("Sara");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [pinned, setPinned] = useState<{ from: string; to: string; note: string } | null>(null);
  const holder = trail[trail.length - 1]!;
  const t = useT("handoffDemo");
  const tAll = useT();
  const role = (name: string) => tAll(`roles.${PEOPLE[name]}`);

  function handOver(e: React.FormEvent) {
    e.preventDefault();
    if (note.trim().length < 10) return setTried(true);
    setPinned({ from: holder, to, note: note.trim() });
    // Stored as who-to-whom and worded when shown, so switching language rewords it too.
    setMsgs((m) => [...m, { kind: "event", text: "", who: holder, to, time: "09:31" }]);
    setTrail((t) => [...t, to]);
    setOpen(false); setNote(""); setTried(false);
    setTo(Object.keys(PEOPLE).find((p) => p !== to && p !== holder) ?? "Priya");
  }

  function reset() {
    setTrail(["Hana"]); setMsgs(START); setPinned(null); setOpen(false); setNote(""); setTried(false); setTo("Sara");
  }

  return (
    <div className={`overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[var(--shadow-2)] ${fixed ? "flex h-[34rem] flex-col" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="grid">
          <span className="font-semibold">Mariam Al Suwaidi</span>
          <span className="text-sm text-muted">{t.rich("handledBy", { name: <strong className="text-text">{holder}</strong>, role: role(holder) })}</span>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className={buttonClass("secondary")}>
          {t("handOver")}
        </button>
      </div>

      <ol className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2 text-sm" aria-label={t("trail")}>
        {trail.map((p, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ArrowRight size={14} className="text-muted rtl:rotate-180" aria-hidden="true" />}
            <span className={`rounded-full px-2 py-0.5 ${i === trail.length - 1 ? "bg-primary-soft font-semibold text-primary" : "text-muted"}`}>{p}</span>
          </li>
        ))}
      </ol>

      {open && (
        <form onSubmit={handOver} className="grid shrink-0 gap-3 border-b border-border bg-surface-2 px-4 py-4">
          <label className="grid gap-1 text-sm font-medium">
            {t("to")}
            <select value={to} onChange={(e) => setTo(e.target.value)} className="min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base font-normal">
              {Object.keys(PEOPLE).filter((p) => p !== holder).map((p) => <option key={p} value={p}>{t("personRole", { name: p, role: role(p) })}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {t("why")}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} dir="auto" placeholder={t("placeholder")}
              aria-describedby="demo-note-help" className="rounded-[var(--radius-control)] border border-input bg-surface px-3 py-2 text-base font-normal" />
          </label>
          <p id="demo-note-help" role={tried ? "alert" : undefined} className={`text-sm ${tried ? "text-fail" : "text-muted"}`}>
            {tried ? t("tooShort") : t("required")}
          </p>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("primary")}>{t("handOver")}</button>
            <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>{tAll("common.cancel")}</button>
          </div>
        </form>
      )}

      <div className={`grid content-start gap-3 bg-bg px-4 py-4 ${fixed ? "min-h-0 flex-1 overflow-y-auto" : full ? "min-h-96" : "min-h-72"}`}>
        {pinned && (
          <div className="grid gap-1 rounded-[var(--radius-panel)] border border-note-border bg-note-soft p-3 text-sm">
            <span>{t.rich("pinnedBy", { from: <strong>{pinned.from}</strong>, to: <strong>{pinned.to}</strong> })}</span>
            <span className="text-base" dir="auto">{pinned.note}</span>
            <span className="flex items-center gap-1 text-muted"><Lock size={14} aria-hidden="true" /> {t("teamOnly")}</span>
          </div>
        )}
        {msgs.map((m, i) =>
          m.kind === "event" ? (
            <p key={i} className="justify-self-center text-center text-sm text-muted">{t("event", { from: m.who!, to: m.to!, role: role(m.to!) })}</p>
          ) : (
            <div key={i} className={`grid max-w-[80%] gap-1 rounded-[var(--radius-panel)] px-3 py-2 ${m.kind === "in" ? "justify-self-start border border-border bg-surface" : "justify-self-end bg-primary-soft"}`}>
              <span dir="auto">{m.text}</span>
              <span className="text-xs text-muted">{m.kind === "out" ? `${t("personComma", { name: m.who!, role: role(m.who!) })} · ` : ""}{m.time}</span>
            </div>
          ),
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted">
        <span>{t("footer")}</span>
        {trail.length > 1 && <button type="button" onClick={reset} className="min-h-11 font-medium text-primary">{t("reset")}</button>}
      </div>
    </div>
  );
}
