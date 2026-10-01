"use client";

import { useState } from "react";
import { Lightning, Trash } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { useFormat, useT } from "@/i18n/client";
import { AiTag } from "./ai-tag";
import { nameAgent, removeRecipe, toggleRecipe, useAiState } from "./store";

export const AGENTS = ["sales", "triage", "receptionist", "briefing"] as const;
export type AgentKey = (typeof AGENTS)[number];

/** Sample state: the receptionist is off by default (decided 2026-09-27: after-hours auto-reply is opt-in). */
const START: Record<AgentKey, boolean> = { sales: true, triage: true, receptionist: false, briefing: true };
const RUNS: Record<AgentKey, number> = { sales: 6, triage: 23, receptionist: 0, briefing: 5 };
/** Sample quality stats this month: drafts approved as written / edited / skipped (decided 2026-10-01). */
const STATS: Partial<Record<AgentKey, [number, number, number]>> = { sales: [14, 6, 3], triage: [41, 5, 2] };
const SENDS = ["location", "photos", "orders"] as const;
const FAQ_SUGGESTIONS = ["parking", "installments"] as const;
const USAGE = [["suggest", 214], ["translate", 96], ["summary", 88], ["ask", 142], ["agents", 120]] as const;

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-ai" : "bg-surface-2 ring-1 ring-border"}`}
    >
      <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[inset-inline-start] ${on ? "start-6" : "start-1"}`} />
    </button>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-0.5">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="max-w-xl text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/* Settings › AI (decided 2026-10-01): agents, automations made with Ask AI, business knowledge, credits, privacy. */
export function AiSettings({ isOwner, credits }: { isOwner: boolean; credits: { left: number; total: number } }) {
  const t = useT("aiSettings");
  const ai = useT("ai");
  const fmt = useFormat();
  const [agents, setAgents] = useState(START);
  const [tone, setTone] = useState("friendly");
  const [sends, setSends] = useState<Record<(typeof SENDS)[number], boolean>>({ location: true, photos: true, orders: true });
  const [faqDone, setFaqDone] = useState<Record<string, "added" | "dismissed">>({});
  const { recipes, spent, names, reports } = useAiState();
  const business = t("labelBusiness");
  const used = credits.total - credits.left + spent;
  const card = "rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border";

  return (
    <div className="grid gap-8">
      {!isOwner && <p className="rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm text-muted">{t("readOnly")}</p>}

      <Section title={t("agents.title")} description={t("agents.description")}>
        <ul className={`${card} overflow-hidden`}>
          {AGENTS.map((k) => (
            <li key={k} className="flex items-start gap-4 border-b border-border px-5 py-4 last:border-0">
              <span className="grid flex-1 gap-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">{t(`agents.${k}.name`)} <AiTag /></span>
                <span className="text-sm text-muted">{t(`agents.${k}.does`)}</span>
                <span className="text-xs text-muted">{t(`agents.${k}.for`)} · {agents[k] ? t("agents.runs", { count: RUNS[k] }) : t("agents.off")}</span>
                {STATS[k] && (
                  <span className="text-xs text-muted">{t("agents.stats", { approved: STATS[k]![0], edited: STATS[k]![1], skipped: STATS[k]![2] })}</span>
                )}
                {isOwner && (
                  <label className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted">{t("agents.nameLabel")}</span>
                    <input
                      defaultValue={names[k] ?? ""}
                      onBlur={(e) => nameAgent(k, e.target.value)}
                      maxLength={30}
                      dir="auto"
                      placeholder={t("agents.namePlaceholder")}
                      className="min-h-9 w-44 rounded-[var(--radius-control)] border border-input bg-surface px-2.5 text-sm"
                    />
                  </label>
                )}
              </span>
              <Toggle on={agents[k]} disabled={!isOwner} label={t(`agents.${k}.name`)} onChange={() => setAgents((a) => ({ ...a, [k]: !a[k] }))} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{t("agents.approval")} {t("agents.nameRule")}</p>
      </Section>

      <Section title={t("receptionist.title")} description={t("receptionist.description")}>
        <div className={`${card} grid gap-4 p-5`}>
          <ul className="grid gap-3">
            {SENDS.map((k) => (
              <li key={k} className="flex items-start justify-between gap-4">
                <span className="grid"><span className="font-medium">{t(`receptionist.sends.${k}.title`)}</span><span className="text-sm text-muted">{t(`receptionist.sends.${k}.body`)}</span></span>
                <Toggle on={sends[k]} disabled={!isOwner} label={t(`receptionist.sends.${k}.title`)} onChange={() => setSends((s) => ({ ...s, [k]: !s[k] }))} />
              </li>
            ))}
          </ul>
          <div className="grid gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium">{t("receptionist.preview")}</p>
            {/* What the customer sees in WhatsApp: the first line always says it's AI. */}
            <div className="max-w-sm rounded-2xl rounded-ss-sm bg-[#DCF8C6] px-3 py-2 text-sm text-[#0F2537] shadow-sm dark:bg-[#1F4E3D] dark:text-white">
              <p className="font-semibold">🤖 {names.receptionist ? t("receptionist.labelNamed", { name: names.receptionist, business }) : t("receptionist.label", { business })}</p>
              <p>{t("receptionist.sample")}</p>
            </div>
            <p className="text-xs text-muted">{t("receptionist.rules")}</p>
          </div>
        </div>
      </Section>

      <Section title={t("recipes.title")} description={t("recipes.description")}>
        {recipes.length === 0 ? (
          <p className={`${card} p-5 text-sm text-muted`}>{t("recipes.empty")}</p>
        ) : (
          <ul className={`${card} overflow-hidden`}>
            {recipes.map((r) => (
              <li key={r.id} className="flex items-start gap-4 border-b border-border px-5 py-4 last:border-0">
                <Lightning size={20} weight="fill" className="mt-0.5 shrink-0 text-ai" aria-hidden="true" />
                <span className="grid flex-1 gap-0.5">
                  <span className="font-medium">{ai(`recipes.${r.key}.name`)}</span>
                  <span className="text-sm text-muted">{ai(`recipes.${r.key}.summary`)}</span>
                </span>
                <Toggle on={r.on} label={ai(`recipes.${r.key}.name`)} onChange={() => toggleRecipe(r.id)} />
                <button type="button" onClick={() => removeRecipe(r.id)} className={buttonClass("ghost", "sm", "!px-2")} aria-label={t("recipes.remove")}>
                  <Trash size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("knowledge.title")} description={t("knowledge.description")}>
        <div className={`${card} grid gap-4 p-5`}>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <p className="text-sm text-muted">{t("knowledge.hours")}</p>
            <p>{t("knowledge.hoursValue")}</p>
          </div>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <p className="text-sm text-muted">{t("knowledge.prices")}</p>
            <p>{t("knowledge.pricesValue")}</p>
          </div>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <p className="text-sm text-muted">{t("knowledge.faq")}</p>
            <ul className="grid gap-2 text-sm">
              {(["delivery", "warranty", "payment"] as const).map((k) => (
                <li key={k} className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2">
                  <span className="font-medium">{t(`knowledge.faqs.${k}.q`)}</span>
                  <span className="block text-muted">{t(`knowledge.faqs.${k}.a`)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <label htmlFor="ai-tone" className="text-sm text-muted">{t("knowledge.tone")}</label>
            <select id="ai-tone" value={tone} disabled={!isOwner} onChange={(e) => setTone(e.target.value)} className="min-h-10 w-fit rounded-[var(--radius-control)] border border-input bg-surface px-3">
              {(["friendly", "formal", "brief"] as const).map((k) => <option key={k} value={k}>{t(`knowledge.tones.${k}`)}</option>)}
            </select>
          </div>
          <div className="grid gap-2 border-t border-border pt-4">
            <p className="flex items-center gap-2 text-sm font-medium">{t("knowledge.suggested")} <AiTag /></p>
            <p className="text-xs text-muted">{t("knowledge.suggestedHelp")}</p>
            <ul className="grid gap-2 text-sm">
              {FAQ_SUGGESTIONS.map((k) => (
                <li key={k} className="grid gap-2 rounded-[var(--radius-control)] border border-dashed border-ai/40 px-3 py-2">
                  <span><span className="font-medium">{t(`knowledge.suggestions.${k}.q`)}</span><span className="block text-muted">{t(`knowledge.suggestions.${k}.a`)}</span><span className="block text-xs text-muted">{t(`knowledge.suggestions.${k}.from`)}</span></span>
                  {faqDone[k] ? (
                    <span className="text-xs text-muted">{faqDone[k] === "added" ? t("knowledge.added") : t("knowledge.dismissed")}</span>
                  ) : isOwner ? (
                    <span className="flex justify-end gap-2">
                      <button type="button" onClick={() => setFaqDone({ ...faqDone, [k]: "dismissed" })} className={buttonClass("ghost", "sm")}>{t("knowledge.dismiss")}</button>
                      <button type="button" onClick={() => setFaqDone({ ...faqDone, [k]: "added" })} className={buttonClass("primary", "sm")}>{t("knowledge.add")}</button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">{t("knowledge.never")}</p>
        </div>
      </Section>

      <Section title={t("feedback.title")} description={t("feedback.description")}>
        <div className={`${card} grid gap-2 p-5 text-sm`}>
          <p>{t("feedback.week", { count: 3 + reports.length })}</p>
          <ul className="grid list-disc gap-1 ps-5 text-muted">
            <li>{t("feedback.sample1")}</li>
            <li>{t("feedback.sample2")}</li>
          </ul>
        </div>
      </Section>

      <Section title={t("credits.title")} description={t("credits.description")}>
        <div className={`${card} grid gap-4 p-5`}>
          <div className="grid gap-2">
            <p className="flex items-baseline justify-between gap-3">
              <span className="display text-3xl">{fmt.number(Math.max(0, credits.total - used))}</span>
              <span className="text-sm text-muted">{t("credits.left", { total: credits.total })}</span>
            </p>
            <span className="h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={t("credits.used", { used, total: credits.total })}>
              <span className="block h-full rounded-full bg-ai" style={{ width: `${Math.min(100, (used / credits.total) * 100)}%` }} />
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {USAGE.map(([k, n]) => (
              <div key={k}>
                <dt className="text-muted">{t(`credits.kinds.${k}`)}</dt>
                <dd className="tabular-nums">{fmt.number(n)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted">{t("credits.prices")}</p>
          {isOwner && <button type="button" disabled className={buttonClass("secondary", "sm", "w-fit")} title={t("credits.topUpSoon")}>{t("credits.topUp")}</button>}
        </div>
      </Section>

      <Section title={t("privacy.title")}>
        <ul className={`${card} grid list-disc gap-1.5 p-5 ps-10 text-sm`}>
          {(["workspace", "noTraining", "role", "ownerOnly", "meta"] as const).map((k) => <li key={k}>{t(`privacy.${k}`)}</li>)}
        </ul>
      </Section>
    </div>
  );
}
