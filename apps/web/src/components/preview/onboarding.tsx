"use client";

import Link from "next/link";
import { useState } from "react";
import { Circle, Plus, X } from "@phosphor-icons/react";
import { ChannelMark } from "@/components/channels/channel-mark";
import type { ChannelKey } from "@/components/channels/catalog";
import { TeamShapeField, type TeamShapeValue } from "@/components/team-shape-field";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { setupSteps } from "@/lib/setup";

/**
 * The welcome wizard (decided 2026-10-07): three short steps (business, first channel, team), then the setup
 * checklist that stays on Home. Every step but the name can be skipped. The preview saves nothing.
 */
const FIRST_CHANNELS: ChannelKey[] = ["whatsapp", "webchat", "email", "instagram", "messenger"];
const STEPS = ["business", "channel", "team"] as const;
const ROLES = ["agent", "sales_manager", "support_manager", "admin"] as const;

export function PreviewOnboarding() {
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [name, setName] = useState("Northwind Home");
  const [website, setWebsite] = useState("northwindhome.com");
  const [shape, setShape] = useState<TeamShapeValue | null>(null);
  const [channel, setChannel] = useState<ChannelKey | null>(null);
  const [invites, setInvites] = useState<{ email: string; role: (typeof ROLES)[number] }[]>([{ email: "", role: "agent" }]);
  const t = useT("onboarding");
  const tAll = useT();
  const setup = useT("setup");
  const common = useT("common");
  const field = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base";
  const invited = invites.filter((i) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.email.trim()));
  const badEmail = invites.some((i) => i.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.email.trim()));

  if (finished) {
    const steps = setupSteps(setup, common, { shape, memberCount: 1 + invited.length, connected: !!channel, base: "/preview/elena" });
    return (
      <div className="grid gap-5">
        <p className="text-muted">{t.rich("ready", { name: <strong className="font-medium text-text">{name || t("yourBusiness")}</strong> })}</p>
        <ol className="grid gap-1">
          {steps.map((s) => (
            <li key={s.title} className="flex items-start gap-3 rounded-[var(--radius-control)] p-3">
              <Circle size={24} weight={s.done ? "fill" : "regular"} className={`mt-0.5 shrink-0 ${s.done ? "text-done" : "text-muted"}`} aria-hidden="true" />
              <span className="grid gap-0.5">
                <span className={`font-medium ${s.done ? "text-muted line-through" : ""}`}>{s.title}</span>
                <span className="text-sm text-muted">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Link href="/preview/elena" className={buttonClass("primary")}>{t("seeOwnerHome")}</Link>
          <button type="button" onClick={() => { setFinished(false); setStep(0); }} className={buttonClass("ghost")}>{common("back")}</button>
        </div>
      </div>
    );
  }

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : setFinished(true));

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 0 && !name.trim()) return;
        if (step === 2 && badEmail) return;
        next();
      }}
    >
      <p className="text-sm text-muted">{t("stepOf", { n: step + 1, total: STEPS.length })} · {t(`steps.${STEPS[step]}`)}</p>
      <ol className="-mt-3 flex gap-1.5" aria-hidden="true">{STEPS.map((s, k) => <li key={s} className={`h-1 flex-1 rounded-full ${k <= step ? "bg-primary" : "bg-border"}`} />)}</ol>

      {step === 0 && (
        <>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("businessName")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className={field} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("website")} <span className="font-normal text-muted">{common("optional")}</span></span>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} dir="ltr" placeholder="example.com" className={field} />
          </label>
          <TeamShapeField value={shape} onChange={setShape} />
        </>
      )}

      {step === 1 && (
        <fieldset className="grid gap-2">
          <legend className="pb-1 text-sm font-medium">{t("channelQuestion")}</legend>
          <p className="text-sm text-muted">{t("channelHelp")}</p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {FIRST_CHANNELS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => setChannel(c)} className={`flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] border px-3 text-start ${channel === c ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2"}`}>
                <ChannelMark ch={c} size={24} label={false} />
                <span className="font-medium">{tAll(`channels.${c}`)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{t("moreChannels")}</p>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="grid gap-2">
          <legend className="pb-1 text-sm font-medium">{t("inviteQuestion")}</legend>
          <p className="text-sm text-muted">{t("inviteHelp")}</p>
          {invites.map((inv, i) => (
            <div key={i} className="flex gap-2">
              <input value={inv.email} onChange={(e) => setInvites(invites.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} type="email" dir="ltr" placeholder="name@company.com" aria-label={t("inviteEmail")} className={`${field} flex-1`} />
              <select value={inv.role} onChange={(e) => setInvites(invites.map((x, j) => (j === i ? { ...x, role: e.target.value as (typeof ROLES)[number] } : x)))} aria-label={t("inviteRole")} className={`${field} w-44`}>
                {ROLES.map((r) => <option key={r} value={r}>{tAll(`roles.${r}`)}</option>)}
              </select>
              {invites.length > 1 && <button type="button" onClick={() => setInvites(invites.filter((_, j) => j !== i))} aria-label={t("removeInvite")} className={buttonClass("ghost", "sm", "!px-2")}><X size={16} aria-hidden="true" /></button>}
            </div>
          ))}
          {badEmail && <p role="alert" className="text-sm text-fail">{t("errors.badEmail")}</p>}
          {invites.length < 10 && <button type="button" onClick={() => setInvites([...invites, { email: "", role: "agent" }])} className={buttonClass("ghost", "sm", "w-fit")}><Plus size={16} aria-hidden="true" /> {t("addAnother")}</button>}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {step > 0 ? <button type="button" onClick={() => setStep(step - 1)} className={buttonClass("ghost")}>{common("back")}</button> : <span />}
        <span className="flex gap-2">
          {step > 0 && <button type="button" onClick={next} className={buttonClass("ghost")}>{t("skip")}</button>}
          <button type="submit" disabled={step === 1 && !channel} className={buttonClass("primary")}>
            {step === 0 ? t("create") : step === 1 ? t("continue") : invited.length ? t("sendInvites", { count: invited.length }) : t("finish")}
          </button>
        </span>
      </div>
    </form>
  );
}
