"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle, Info, PaperPlaneTilt } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { ChannelMark } from "@/components/channels/channel-mark";
import { smsParts } from "@/components/channels/rules";
import { useFormat, useT } from "@/i18n/client";
import { APPROVAL_OVER, CAMPAIGN_CHANNELS, SEGMENTS, SMS_RATE_CENTS, WA_RATE_CENTS, WA_TEMPLATES, audience, type CampaignChannel } from "./sample";

/**
 * Building a campaign (decided 2026-10-07): channel and audience (consent enforced, exclusions shown), the
 * message in that channel's own form, an optional A/B test, timing (now, a set time, or the same local time
 * per customer), then a review with the cost, a test send, and owner/admin approval over 1,000 recipients.
 */
const STEPS = ["audience", "message", "schedule", "review"] as const;
type When = "now" | "at" | "local";

export function CampaignBuilder({ base, canApprove, canSend }: { base: string; canApprove: boolean; canSend: boolean }) {
  const t = useT("campaignsPage");
  const tAll = useT();
  const fmt = useFormat();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [ch, setCh] = useState<CampaignChannel>("email");
  const [segment, setSegment] = useState(SEGMENTS[1].id);
  const [subject, setSubject] = useState("");
  const [preview, setPreview] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState(WA_TEMPLATES[0].name);
  const [vars, setVars] = useState<string[]>(["{first name}", "Halo desk lamp"]);
  const [ab, setAb] = useState(false);
  const [bValue, setBValue] = useState("");
  const [when, setWhen] = useState<When>("now");
  const [at, setAt] = useState("");
  const [localTime, setLocalTime] = useState("10:00");
  const [tested, setTested] = useState(false);
  const [done, setDone] = useState<"sent" | "scheduled" | "approval" | null>(null);

  const seg = SEGMENTS.find((s) => s.id === segment)!;
  const a = audience(seg, ch);
  const tpl = WA_TEMPLATES.find((x) => x.name === template)!;
  const sms = ch === "sms" ? smsParts(body) : null;
  const costCents = ch === "whatsapp" ? a.eligible * WA_RATE_CENTS[tpl.category] : ch === "sms" ? a.eligible * SMS_RATE_CENTS * (sms?.parts ?? 1) : 0;
  const needsApproval = a.eligible > APPROVAL_OVER && !canApprove;
  const filled = tpl.body.replace(/\{\{(\d)\}\}/g, (_, n) => vars[Number(n) - 1] || `{{${n}}}`);
  const field = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm";
  const ready = [
    name.trim().length > 0 && a.eligible > 0,
    ch === "whatsapp" ? tpl.variables.every((_, i) => vars[i]?.trim()) : ch === "email" ? !!subject.trim() && !!body.trim() : !!body.trim(),
    when === "now" || (when === "at" ? !!at : !!localTime),
    true,
  ][step];

  if (done) {
    return (
      <div className="grid justify-items-start gap-3 rounded-[var(--radius-panel)] border border-border bg-surface p-6">
        <p className="flex items-center gap-2 text-lg font-semibold"><CheckCircle size={24} weight="fill" className="text-done" aria-hidden="true" />{t(`done.${done}`)}</p>
        <p className="text-muted">{t("previewNote")}</p>
        <Link href={`${base}/campaigns`} className={buttonClass("primary", "md")}>{t("title")}</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Link href={`${base}/campaigns`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />{t("title")}</Link>
      <header className="grid gap-1">
        <h1 className="title text-2xl">{name || t("new")}</h1>
        <p className="text-sm text-muted">{t("stepOf", { n: step + 1, total: STEPS.length })} · {t(`steps.${STEPS[step]}`)}</p>
      </header>
      <ol className="flex gap-1.5" aria-hidden="true">{STEPS.map((s, k) => <li key={s} className={`h-1 flex-1 rounded-full ${k <= step ? "bg-primary" : "bg-border"}`} />)}</ol>

      <section className="grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6">
        {step === 0 && (
          <>
            <label className="grid gap-1 text-sm font-medium">{t("name")}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={field} placeholder={t("namePlaceholder")} /></label>
            <fieldset className="grid gap-2">
              <legend className="pb-1 text-sm font-medium">{t("channel")}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {CAMPAIGN_CHANNELS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={ch === c} onClick={() => setCh(c)} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm ${ch === c ? "border-primary bg-primary-soft text-primary" : "border-border"}`}>
                    <ChannelMark ch={c} size={18} label={false} />{tAll(`channels.${c}`)}
                  </button>
                ))}
              </div>
              {(ch === "messenger" || ch === "instagram") && <p className="flex gap-2 text-sm text-muted"><Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{t("metaWindow")}</p>}
            </fieldset>
            <label className="grid gap-1 text-sm font-medium">
              {t("segment")}
              <select value={segment} onChange={(e) => setSegment(e.target.value)} className={field}>{SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.name} ({fmt.number(s.size)})</option>)}</select>
            </label>
            <dl className="grid gap-1.5 rounded-[var(--radius-control)] bg-surface-2 p-4 text-sm">
              <div className="flex justify-between"><dt>{t("inSegment")}</dt><dd className="tabular-nums">{fmt.number(a.total)}</dd></div>
              {(["noHandle", "noConsent", "dnc", "outsideWindow"] as const).filter((k) => a.excluded[k] > 0).map((k) => (
                <div key={k} className="flex justify-between text-muted"><dt>{t(`excluded.${k}`, { channel: tAll(`channels.${ch}`) })}</dt><dd className="tabular-nums">−{fmt.number(a.excluded[k])}</dd></div>
              ))}
              <div className="flex justify-between border-t border-border pt-1.5 font-medium"><dt>{t("willReceive")}</dt><dd className="tabular-nums">{fmt.number(a.eligible)}</dd></div>
            </dl>
          </>
        )}

        {step === 1 && (
          <>
            {ch === "whatsapp" ? (
              <>
                <label className="grid gap-1 text-sm font-medium">
                  {t("template")}
                  <select value={template} onChange={(e) => setTemplate(e.target.value)} className={field}>{WA_TEMPLATES.map((x) => <option key={x.name} value={x.name}>{x.name} · {t(`category.${x.category}`)}</option>)}</select>
                  <span className="font-normal text-muted">{t("templateHelp")}</span>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tpl.variables.map((v, i) => (
                    <label key={v} className="grid gap-1 text-sm font-medium">{`{{${i + 1}}} ${v}`}<input value={vars[i] ?? ""} onChange={(e) => setVars(Object.assign([...vars], { [i]: e.target.value }))} className={field} /></label>
                  ))}
                </div>
                <p className="max-w-md rounded-[12px] rounded-ss-sm bg-surface-2 p-3 text-sm">{filled}</p>
              </>
            ) : (
              <>
                {ch === "email" && (
                  <>
                    <label className="grid gap-1 text-sm font-medium">{t("subject")}<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className={field} /></label>
                    <label className="grid gap-1 text-sm font-medium">{t("previewText")}<input value={preview} onChange={(e) => setPreview(e.target.value)} maxLength={140} className={field} /><span className="font-normal text-muted">{t("previewHelp")}</span></label>
                  </>
                )}
                <label className="grid gap-1 text-sm font-medium">
                  {t("body")}
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={ch === "email" ? 8 : 3} className="w-full rounded-[var(--radius-control)] border border-input bg-surface p-3 text-sm" />
                  {sms && <span className="font-normal tabular-nums text-muted">{tAll("omni.composer.smsParts", { count: sms.parts, used: body.length, limit: sms.limit })} · {t("smsStopAdded")}</span>}
                  {ch === "email" && <span className="font-normal text-muted">{t("unsubscribeAdded")}</span>}
                </label>
              </>
            )}
            {ch !== "whatsapp" && (
              <div className="grid gap-2 border-t border-border pt-4">
                <label className="flex items-center justify-between gap-4 text-sm"><span className="grid"><span className="font-medium">{t("abToggle")}</span><span className="text-muted">{t("abHelp")}</span></span><input type="checkbox" role="switch" checked={ab} onChange={(e) => setAb(e.target.checked)} className="size-5 accent-[var(--primary)]" /></label>
                {ab && <label className="grid gap-1 text-sm font-medium">{ch === "email" ? t("abSubject") : t("abBody")}<input value={bValue} onChange={(e) => setBValue(e.target.value)} className={field} /></label>}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <fieldset className="grid gap-3">
            <legend className="pb-1 text-sm font-medium">{t("whenTitle")}</legend>
            {(["now", "at", "local"] as const).map((w) => (
              <label key={w} className={`grid gap-2 rounded-[var(--radius-control)] border p-3 text-sm ${when === w ? "border-primary bg-primary-soft" : "border-border"}`}>
                <span className="flex items-center gap-2"><input type="radio" name="when" checked={when === w} onChange={() => setWhen(w)} className="accent-[var(--primary)]" /><span className="font-medium">{t(`when.${w}`)}</span></span>
                {w === "at" && when === "at" && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={`${field} max-w-60`} />}
                {w === "local" && when === "local" && <span className="flex items-center gap-2"><input type="time" value={localTime} onChange={(e) => setLocalTime(e.target.value)} className={`${field} max-w-32`} /><span className="text-muted">{t("localHelp")}</span></span>}
              </label>
            ))}
          </fieldset>
        )}

        {step === 3 && (
          <dl className="grid gap-2 text-sm">
            {([
              [t("name"), name],
              [t("channel"), tAll(`channels.${ch}`)],
              [t("segment"), seg.name],
              [t("willReceive"), fmt.number(a.eligible)],
              [t("whenTitle"), when === "now" ? t("when.now") : when === "at" ? at.replace("T", " ") : t("localAt", { time: localTime })],
              ...(ab ? [[t("abTitle"), t("abSummary")]] : []),
              ...(costCents ? [[t("cost"), `${fmt.money(Math.round(costCents))} ${t("costNote")}`]] : []),
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-border pb-2"><dt className="text-muted">{k}</dt><dd className="text-end">{v}</dd></div>
            ))}
            {needsApproval && <p className="flex gap-2 rounded-[var(--radius-control)] bg-warn-soft p-3"><Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{t("needsApproval", { over: fmt.number(APPROVAL_OVER) })}</p>}
            <p className="flex flex-wrap items-center gap-3 pt-2">
              <button type="button" onClick={() => setTested(true)} className={buttonClass("secondary", "sm")}><PaperPlaneTilt size={16} aria-hidden="true" /> {t("testSend")}</button>
              {tested && <span role="status" className="text-muted">{t("testSent")}</span>}
            </p>
          </dl>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className={buttonClass("ghost", "md")}>{tAll("connect.backStep")}</button>}
        {step < STEPS.length - 1 ? (
          <button type="button" disabled={!ready} onClick={() => setStep(step + 1)} className={buttonClass("primary", "md")}>{tAll("connect.next")}</button>
        ) : (
          <button
            type="button"
            onClick={() => setDone(needsApproval || !canSend ? "approval" : when === "now" ? "sent" : "scheduled")}
            className={buttonClass("primary", "md")}
          >
            {needsApproval || !canSend ? t("requestApproval") : when === "now" ? t("sendNow") : t("schedule")}
          </button>
        )}
      </div>
    </div>
  );
}
