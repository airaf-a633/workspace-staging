"use client";

import Link from "next/link";
import { useState } from "react";
import { CaretDown, Check, Sparkle } from "@phosphor-icons/react";
import type { RoleTemplateKey } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { useFormat, useT } from "@/i18n/client";
import type { AiWorld } from "@/lib/ai-sample";
import { AiTag } from "./ai-tag";
import type { AgentKey } from "./ai-settings";
import { useAiState } from "./store";

/** Which agents report to which role (decided 2026-10-01). Each works with that person's own permissions. */
const FOR: Record<RoleTemplateKey, AgentKey[]> = {
  owner: ["briefing", "sales", "triage", "receptionist"],
  sales_manager: ["sales", "briefing"],
  support_manager: ["triage", "receptionist", "briefing"],
  ops_manager: ["briefing"],
  agent: ["sales"],
  viewer: ["briefing"],
};

/* "From your agents" on Home: what each agent prepared overnight, waiting for a person to approve. */
export function AgentBriefings({ world }: { world: AiWorld }) {
  const t = useT("briefings");
  const agents = FOR[world.me.template].filter((a) => (a === "sales" ? world.canDeals && world.quietDeals.length > 0 : true));
  if (agents.length === 0) return null;
  return (
    <section aria-labelledby="agents" className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="agents" className="flex items-center gap-2 text-lg font-semibold"><Sparkle size={18} weight="fill" className="text-ai" aria-hidden="true" /> {t("title")}</h2>
        <Link href={`${world.base}/ai`} className="text-sm text-muted hover:text-text">{t("manage")}</Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {agents.map((a) => <Card key={a} agent={a} world={world} />)}
      </div>
    </section>
  );
}

function Card({ agent, world }: { agent: AgentKey; world: AiWorld }) {
  const t = useT("briefings");
  const ai = useT("aiSettings");
  const [open, setOpen] = useState(agent === "briefing");
  const { names } = useAiState();
  const headline =
    agent === "sales" ? t("sales.headline", { count: world.quietDeals.length })
    : agent === "triage" ? t("triage.headline", { count: world.unclaimed.length })
    : agent === "receptionist" ? t("receptionist.headline")
    : t("briefing.headline", { name: world.me.name });

  return (
    <article className="grid content-start gap-3 rounded-[var(--radius-panel)] bg-surface p-4 shadow-[var(--shadow-1)] ring-1 ring-ai/25">
      <header className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">{names[agent] ? <><bdi className="font-medium text-text">{names[agent]}</bdi> · {ai(`agents.${agent}.name`)}</> : ai(`agents.${agent}.name`)} <AiTag /></p>
          <p className="font-medium">{headline}</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={buttonClass("ghost", "sm", "!px-2")} aria-label={open ? t("hide") : t("show")}>
          <CaretDown size={18} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </header>
      {open && (agent === "sales" ? <SalesDrafts world={world} /> : agent === "triage" ? <Triage world={world} /> : agent === "receptionist" ? <Receptionist world={world} /> : <Briefing world={world} />)}
    </article>
  );
}

/** "Khalifa" for a person, the full name for a business ("Al Noor Trading", never "Al"). */
const greetName = (n: string) => (/trading|llc|clinic|group|company|co|est\.?$/i.test(n) ? n : n.split(" ")[0]);

/** One drafted follow-up per quiet quote: approve, edit or skip. Nothing is sent without a click. */
function SalesDrafts({ world }: { world: AiWorld }) {
  const t = useT("briefings");
  const [state, setState] = useState<Record<string, "sent" | "skipped" | "editing" | undefined>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(world.quietDeals.map((d) => [d.id, t("sales.draft", { name: greetName(d.customer), title: d.title })])),
  );
  const pending = world.quietDeals.filter((d) => !state[d.id] || state[d.id] === "editing");
  const [reviewing, setReviewing] = useState(false);
  const sendAll = () => {
    setState((s) => ({ ...s, ...Object.fromEntries(pending.map((d) => [d.id, "sent" as const])) }));
    setReviewing(false);
  };
  if (reviewing) {
    return (
      <div className="grid gap-3 border-t border-border pt-3 text-sm">
        <p className="font-medium">{t("sales.reviewTitle", { count: pending.length })}</p>
        <ol className="grid gap-2">
          {pending.map((d) => (
            <li key={d.id} className="grid gap-1 rounded-[var(--radius-control)] bg-ai-soft/60 px-3 py-2">
              <bdi className="font-medium">{d.customer}</bdi>
              <span dir="auto">{drafts[d.id]}</span>
            </li>
          ))}
        </ol>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setReviewing(false)} className={buttonClass("ghost", "sm")}>{t("sales.back")}</button>
          <button type="button" onClick={sendAll} className={buttonClass("primary", "sm")}>{t("sales.sendAll", { count: pending.length })}</button>
        </div>
      </div>
    );
  }
  return (
    <ul className="grid gap-3">
      {pending.length > 1 && (
        <li className="flex justify-end">
          <button type="button" onClick={() => setReviewing(true)} className={buttonClass("secondary", "sm")}>{t("sales.approveAll", { count: pending.length })}</button>
        </li>
      )}
      {world.quietDeals.map((d) => {
        const s = state[d.id];
        return (
          <li key={d.id} className="grid gap-2 border-t border-border pt-3 text-sm">
            <p className="flex justify-between gap-2"><Link href={`${world.base}/deals?deal=${d.id}`} className="font-medium hover:underline"><bdi>{d.customer}</bdi></Link><span className="text-muted">{t("sales.quiet", { count: d.quietDays })}</span></p>
            {s === "sent" ? (
              <p className="flex items-center gap-1.5 text-done"><Check size={16} aria-hidden="true" /> {t("sales.sent")}</p>
            ) : s === "skipped" ? (
              <p className="text-muted">{t("sales.skipped")}</p>
            ) : s === "editing" ? (
              <textarea dir="auto" rows={3} value={drafts[d.id]} onChange={(e) => setDrafts({ ...drafts, [d.id]: e.target.value })} className="rounded-[var(--radius-control)] border border-input bg-surface px-3 py-2" aria-label={t("sales.editLabel", { name: d.customer })} />
            ) : (
              <p className="rounded-[var(--radius-control)] bg-ai-soft/60 px-3 py-2" dir="auto">{drafts[d.id]}</p>
            )}
            {s !== "sent" && s !== "skipped" && (
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setState({ ...state, [d.id]: "skipped" })} className={buttonClass("ghost", "sm")}>{t("sales.skip")}</button>
                {s !== "editing" && <button type="button" onClick={() => setState({ ...state, [d.id]: "editing" })} className={buttonClass("secondary", "sm")}>{t("sales.edit")}</button>}
                <button type="button" onClick={() => setState({ ...state, [d.id]: "sent" })} className={buttonClass("primary", "sm")}>{t("sales.approve")}</button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Triage({ world }: { world: AiWorld }) {
  const t = useT("briefings");
  const fmt = useFormat();
  if (world.unclaimed.length === 0) return <p className="text-sm text-muted">{t("triage.none")}</p>;
  return (
    <ul className="grid gap-2 text-sm">
      {world.unclaimed.map((c, i) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <span className="grid">
            <bdi className="font-medium">{c.customer}</bdi>
            <span className={i === 0 ? "text-warn" : "text-muted"}>{i === 0 ? t("triage.urgent", { time: fmt.minutesWaited(c.waitingMin) }) : t("triage.tagged")}</span>
          </span>
          <Link href={`${world.base}/inbox?c=${c.id}`} className={buttonClass("secondary", "sm")}>{t("triage.open")}</Link>
        </li>
      ))}
    </ul>
  );
}

function Receptionist({ world }: { world: AiWorld }) {
  const t = useT("briefings");
  return (
    <div className="grid gap-2 text-sm">
      <p className="text-muted">{t("receptionist.body")}</p>
      <Link href={`${world.base}/ai`} className={buttonClass("secondary", "sm", "w-fit")}>{t("receptionist.setUp")}</Link>
    </div>
  );
}

function Briefing({ world }: { world: AiWorld }) {
  const t = useT("briefings");
  return (
    <ul className="grid list-disc gap-1 ps-5 text-sm">
      <li>{t("briefing.tasks", { count: world.tasksToday.length })}</li>
      {world.overdue.length > 0 && <li className="text-warn">{t("briefing.overdue", { count: world.overdue.length })}</li>}
      <li>{t("briefing.unclaimed", { count: world.unclaimed.length })}</li>
      {world.canDeals && <li>{t("briefing.quiet", { count: world.quietDeals.length })}</li>}
    </ul>
  );
}
