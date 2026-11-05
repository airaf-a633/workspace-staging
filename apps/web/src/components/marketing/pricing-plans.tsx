"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkle } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { useFormat, useT } from "@/i18n/client";
import { PLANS, POPULAR, TRIAL_DAYS, yearlyMonthly } from "@/lib/plans";

/** The three plans with a monthly / yearly switch (yearly = two months free). Every button starts the same trial. */
export function PricingPlans() {
  const t = useT("pricing");
  const b = useT("billing");
  const fmt = useFormat();
  const [yearly, setYearly] = useState(true);

  return (
    <div className="grid gap-8">
      <div role="radiogroup" aria-label={t("billingLabel")} className="mx-auto inline-flex rounded-full bg-surface-2 p-1 text-sm">
        {([false, true] as const).map((y) => (
          <button
            key={String(y)}
            type="button"
            role="radio"
            aria-checked={yearly === y}
            onClick={() => setYearly(y)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${
              yearly === y ? "bg-surface text-text shadow-[var(--shadow-1)]" : "text-muted hover:text-text"
            }`}
          >
            {y ? t("yearly") : t("monthly")}
            {y && <span className="rounded-full bg-done-soft px-2 py-0.5 text-xs text-done">{t("twoMonthsFree")}</span>}
          </button>
        ))}
      </div>

      <ul className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        {PLANS.map((p) => {
          const popular = p.key === POPULAR;
          const per = yearly ? yearlyMonthly(p.price) : p.price;
          return (
            <li
              key={p.key}
              className={`relative grid content-start gap-6 rounded-[var(--radius-panel)] p-7 ${
                popular ? "bg-surface shadow-[var(--shadow-float)] ring-2 ring-primary" : "bg-surface ring-1 ring-border"
              }`}
            >
              {popular && (
                <span className="absolute -top-3 start-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary">{t("popular")}</span>
              )}
              <div className="grid gap-1.5">
                <h3 className="text-lg font-semibold">{b(`plans.${p.key}`)}</h3>
                <p className="min-h-[3rem] text-sm text-muted">{t(`for.${p.key}`)}</p>
              </div>
              <div className="grid gap-1">
                <p className="flex items-baseline gap-1.5">
                  <span className="display text-5xl tabular-nums">{Number.isInteger(per) ? fmt.moneyWhole(per) : fmt.money(Math.round(per * 100))}</span>
                  <span className="text-sm text-muted">{t("perUser")}</span>
                </p>
                <p className="text-sm text-muted">
                  {yearly ? t("billedYearly", { total: fmt.moneyWhole(p.price * 10) }) : t("billedMonthly")}
                </p>
              </div>
              <Link href="/sign-up" className={buttonClass(popular ? "primary" : "secondary", "lg", "w-full justify-center active:scale-[0.98]")}>
                {t("cta", { days: TRIAL_DAYS })}
              </Link>
              <ul className="grid gap-2.5 text-sm">
                <li className="flex gap-2.5">
                  <Sparkle size={18} weight="fill" className="mt-0.5 shrink-0 text-ai" aria-hidden="true" />
                  {b("creditsPerSeat", { count: fmt.number(p.credits) })}
                </li>
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    {b(`features.${f}`)}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
