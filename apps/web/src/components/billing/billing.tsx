"use client";

import { useState } from "react";
import { Check, CreditCard, DownloadSimple, Info, Minus, Plus, Sparkle } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { useFormat, useT } from "@/i18n/client";

/**
 * Settings › Billing (decided 2026-10-07): per-seat plans (sample prices until the founders set real ones),
 * seats with proration, usage with pass-through message costs and a spend limit, invoices and the card, and a
 * trial countdown with cancel-anytime. Owners and admins only (billing.manage).
 */
type PlanKey = "starter" | "growth" | "pro";
type Feature = "inbox" | "channels" | "helpCenter" | "reports" | "sla" | "campaigns" | "customRoles" | "sso" | "audit" | "api";
const PLANS: { key: PlanKey; price: number; credits: number; features: Feature[] }[] = [
  { key: "starter", price: 19, credits: 100, features: ["inbox", "channels", "helpCenter", "reports"] },
  { key: "growth", price: 39, credits: 500, features: ["inbox", "channels", "helpCenter", "reports", "sla", "campaigns", "customRoles"] },
  { key: "pro", price: 79, credits: 2_000, features: ["inbox", "channels", "helpCenter", "reports", "sla", "campaigns", "customRoles", "sso", "audit", "api"] },
];
const INVOICES = [
  { id: "INV-2026-0009", daysAgo: 6, cents: 23_400 + 1_826 },
  { id: "INV-2026-0008", daysAgo: 37, cents: 19_500 + 1_412 },
  { id: "INV-2026-0007", daysAgo: 67, cents: 19_500 + 980 },
];

export function Billing({ activeMembers, now }: { activeMembers: number; now: number }) {
  const t = useT("billing");
  const fmt = useFormat();
  const [plan, setPlan] = useState<PlanKey>("growth");
  const [choosing, setChoosing] = useState(false);
  const [seats, setSeats] = useState(Math.max(6, activeMembers));
  const [limit, setLimit] = useState("100");
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const current = PLANS.find((p) => p.key === plan)!;
  const DAY = 86_400_000;
  const periodEnd = now + 24 * DAY;
  const trialDaysLeft = 9;
  const monthly = current.price * seats;
  const usage = { aiUsed: 660, aiTotal: current.credits * seats, whatsapp: { count: 1_412, cents: 1_208 }, sms: { count: 640, cents: 512 } };
  const passThrough = usage.whatsapp.cents + usage.sms.cents;
  const card = "grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6";

  return (
    <div className="grid gap-6">
      <p className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-primary-soft px-5 py-3 text-sm">
        <span>{t("trial", { days: trialDaysLeft, date: fmt.shortDate(now + trialDaysLeft * DAY) })}</span>
        <span className="text-xs text-muted">{t("samplePrices")}</span>
      </p>
      {note && <p role="status" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-done-soft px-4 py-2 text-sm"><Info size={16} aria-hidden="true" />{note} {t("previewNote")}</p>}

      <section className={card} aria-labelledby="b-plan">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 id="b-plan" className="text-base font-semibold">{t("planTitle", { plan: t(`plans.${plan}`) })} {cancelled && <Badge tone="warn">{t("cancelled")}</Badge>}</h2>
            <p className="text-sm text-muted">{t("planLine", { price: fmt.moneyWhole(current.price), seats, total: fmt.moneyWhole(monthly) })}</p>
            <p className="text-sm text-muted">{cancelled ? t("accessUntil", { date: fmt.shortDate(periodEnd) }) : t("nextInvoice", { date: fmt.shortDate(periodEnd) })}</p>
          </div>
          <button type="button" onClick={() => setChoosing(!choosing)} aria-expanded={choosing} className={buttonClass("secondary", "sm")}>{t("changePlan")}</button>
        </div>

        {choosing && (
          <div className="grid gap-3 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.key} className={`grid content-start gap-3 rounded-[var(--radius-control)] border p-4 ${p.key === plan ? "border-primary bg-primary-soft" : "border-border"}`}>
                <div className="grid gap-0.5">
                  <span className="font-semibold">{t(`plans.${p.key}`)}</span>
                  <span className="text-sm"><span className="text-2xl font-medium tabular-nums">{fmt.moneyWhole(p.price)}</span> <span className="text-muted">{t("perSeat")}</span></span>
                </div>
                <ul className="grid gap-1 text-sm">
                  <li className="flex gap-2"><Sparkle size={16} weight="fill" className="mt-0.5 shrink-0 text-ai" aria-hidden="true" />{t("creditsPerSeat", { count: fmt.number(p.credits) })}</li>
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{t(`features.${f}`)}</li>)}
                </ul>
                {p.key === plan ? <span className="text-sm font-medium text-primary">{t("currentPlan")}</span> : (
                  <button type="button" onClick={() => { setPlan(p.key); setChoosing(false); setNote(PLANS.indexOf(p) > PLANS.indexOf(current) ? t("upgraded", { plan: t(`plans.${p.key}`) }) : t("downgraded", { plan: t(`plans.${p.key}`), date: fmt.shortDate(periodEnd) })); }} className={buttonClass(PLANS.indexOf(p) > PLANS.indexOf(current) ? "primary" : "ghost", "sm")}>
                    {PLANS.indexOf(p) > PLANS.indexOf(current) ? t("upgrade") : t("downgrade")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="grid text-sm"><span className="font-medium">{t("seats")}</span><span className="text-muted">{t("seatsHelp", { members: activeMembers })}</span></span>
          <span className="flex items-center gap-2">
            <button type="button" disabled={seats <= activeMembers} onClick={() => setSeats(seats - 1)} aria-label={t("removeSeat")} className={buttonClass("secondary", "sm", "!px-2.5")}><Minus size={16} aria-hidden="true" /></button>
            <span className="w-8 text-center tabular-nums">{seats}</span>
            <button type="button" onClick={() => setSeats(seats + 1)} aria-label={t("addSeat")} className={buttonClass("secondary", "sm", "!px-2.5")}><Plus size={16} aria-hidden="true" /></button>
          </span>
        </div>
        {seats <= activeMembers && <p className="text-xs text-muted">{t("seatsFloor")}</p>}
        <p className="text-xs text-muted">{t("prorated")}</p>
      </section>

      <section className={card} aria-labelledby="b-usage">
        <h2 id="b-usage" className="text-base font-semibold">{t("usage")}</h2>
        <div className="grid gap-1.5 text-sm">
          <span className="flex justify-between"><span className="flex items-center gap-1.5"><Sparkle size={14} weight="fill" className="text-ai" aria-hidden="true" />{t("aiCredits")}</span><span className="tabular-nums">{t("creditsUsed", { used: fmt.number(usage.aiUsed), total: fmt.number(usage.aiTotal) })}</span></span>
          <span className="h-2 rounded-full bg-surface-2"><span className="block h-2 rounded-full bg-ai" style={{ width: `${(usage.aiUsed / usage.aiTotal) * 100}%` }} /></span>
        </div>
        <dl className="grid gap-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt>{t("whatsappMessages", { count: fmt.number(usage.whatsapp.count) })}</dt><dd className="tabular-nums">{fmt.money(usage.whatsapp.cents)}</dd></div>
          <div className="flex justify-between"><dt>{t("smsMessages", { count: fmt.number(usage.sms.count) })}</dt><dd className="tabular-nums">{fmt.money(usage.sms.cents)}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 font-medium"><dt>{t("passThrough")}</dt><dd className="tabular-nums">{fmt.money(passThrough)}</dd></div>
        </dl>
        <p className="text-xs text-muted">{t("atCost")}</p>
        <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="grid"><span className="font-medium">{t("spendLimit")}</span><span className="text-muted">{t("spendLimitHelp")}</span></span>
          <span className="flex items-center gap-1"><span className="text-muted">$</span><input value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="min-h-10 w-24 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm tabular-nums" /></span>
        </label>
      </section>

      <section className={card} aria-labelledby="b-pay">
        <h2 id="b-pay" className="text-base font-semibold">{t("payment")}</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-3"><CreditCard size={24} className="text-muted" aria-hidden="true" /><span className="grid"><span>{t("cardOnFile")}</span><span className="text-muted">{t("cardExpires")}</span></span></span>
          <button type="button" onClick={() => setNote(t("cardNote"))} className={buttonClass("ghost", "sm")}>{t("updateCard")}</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">{t("billingEmail")}<input defaultValue="accounts@northwindhome.com" type="email" dir="ltr" className="min-h-10 rounded-[var(--radius-control)] border border-input bg-surface px-3" /></label>
          <label className="grid gap-1 text-sm font-medium">{t("taxId")}<input defaultValue="GB 123 4567 89" dir="ltr" className="min-h-10 rounded-[var(--radius-control)] border border-input bg-surface px-3" /></label>
        </div>
        <table className="w-full text-sm">
          <caption className="pb-2 text-start font-medium">{t("invoices")}</caption>
          <tbody>
            {INVOICES.map((inv) => (
              <tr key={inv.id} className="border-t border-border">
                <td className="py-2.5">{fmt.shortDate(now - inv.daysAgo * DAY)}</td>
                <td className="text-muted">{inv.id}</td>
                <td className="text-end tabular-nums">{fmt.money(inv.cents)}</td>
                <td className="px-3"><Badge tone="done">{t("paid")}</Badge></td>
                <td className="text-end"><button type="button" onClick={() => setNote(t("pdfNote"))} className={buttonClass("ghost", "sm", "!px-2")} aria-label={t("downloadPdf", { id: inv.id })}><DownloadSimple size={16} aria-hidden="true" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-3 rounded-[var(--radius-panel)] border border-fail/30 bg-surface p-5 sm:p-6" aria-labelledby="b-cancel">
        <h2 id="b-cancel" className="text-base font-semibold">{t("cancelTitle")}</h2>
        {cancelled ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>{t("cancelledBody", { date: fmt.shortDate(periodEnd) })}</p>
            <button type="button" onClick={() => setCancelled(false)} className={buttonClass("primary", "sm")}>{t("resume")}</button>
          </div>
        ) : cancelling ? (
          <div className="grid gap-3 text-sm">
            <p>{t("cancelBody", { date: fmt.shortDate(periodEnd) })}</p>
            <label className="grid gap-1 sm:max-w-sm">
              {t("reason")}
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-10 rounded-[var(--radius-control)] border border-input bg-surface px-3">
                <option value="">{t("reasonChoose")}</option>
                {(["price", "features", "switching", "closing", "other"] as const).map((r) => <option key={r} value={r}>{t(`reasons.${r}`)}</option>)}
              </select>
            </label>
            <p className="text-muted">{t("exportFirst")}</p>
            <span className="flex gap-2">
              <button type="button" onClick={() => setCancelling(false)} className={buttonClass("ghost", "sm")}>{t("keep")}</button>
              <button type="button" disabled={!reason} onClick={() => { setCancelled(true); setCancelling(false); }} className={buttonClass("destructive", "sm")}>{t("confirmCancel")}</button>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted">{t("cancelHelp")}</p>
            <button type="button" onClick={() => setCancelling(true)} className={buttonClass("ghost", "sm", "text-fail")}>{t("cancel")}</button>
          </div>
        )}
      </section>
    </div>
  );
}
