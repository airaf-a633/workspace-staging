import Link from "next/link";
import { Check, Minus } from "@phosphor-icons/react/dist/ssr";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";
import { PILOT, PLANS, TRIAL_DAYS, type PlanFeature } from "@/lib/plans";

export async function generateMetadata() {
  const t = await getT("pricing");
  return PILOT ? { title: t("pilot.metaTitle"), description: t("pilot.metaDescription") } : { title: t("metaTitle"), description: t("metaDescription") };
}

/* Pricing (2026-10-19): one price per user, every channel on every plan, no per-channel or per-conversation fees. */
const ROWS: PlanFeature[] = ["inbox", "channels", "helpCenter", "reports", "sla", "campaigns", "customRoles", "sso", "audit", "api"];
const FAQ = ["trial", "user", "messages", "credits", "change", "cancel"] as const;

const NOW = ["inbox", "handoff", "crm", "homes"] as const;
const SOON = ["meta", "help", "campaigns", "billing"] as const;

export default async function Pricing() {
  const t = await getT("pricing");
  const b = await getT("billing");

  // The private pilot (decided 2026-11-03): no prices, plans or trial are shown; the page says what works today and what is coming.
  if (PILOT) {
    return (
      <main className="overflow-x-clip">
        <section className="mx-auto grid max-w-3xl gap-10 px-4 pb-24 pt-14 lg:pt-20">
          <header className="grid gap-4 text-center">
            <h1 className="display text-4xl sm:text-5xl">{t("pilot.title")}</h1>
            <p className="text-lg text-muted">{t("pilot.body")}</p>
          </header>
          <div className="grid gap-6 sm:grid-cols-2">
            <section className="grid content-start gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-1 ring-border" aria-labelledby="pilot-now">
              <h2 id="pilot-now" className="text-lg font-semibold">{t("pilot.nowTitle")}</h2>
              <ul className="grid gap-3">
                {NOW.map((k) => (
                  <li key={k} className="flex gap-3"><Check size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{t(`pilot.now.${k}`)}</li>
                ))}
              </ul>
            </section>
            <section className="grid content-start gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-1 ring-border" aria-labelledby="pilot-soon">
              <h2 id="pilot-soon" className="text-lg font-semibold">{t("pilot.soonTitle")}</h2>
              <ul className="grid gap-3">
                {SOON.map((k) => (
                  <li key={k} className="flex gap-3 text-muted"><Minus size={20} className="mt-0.5 shrink-0" aria-hidden="true" />{t(`pilot.soon.${k}`)}</li>
                ))}
              </ul>
            </section>
          </div>
          <div className="bg-hero grid gap-4 rounded-[var(--radius-panel)] px-6 py-10 text-center text-white">
            <h2 className="display text-3xl">{t("pilot.joinTitle")}</h2>
            <p className="text-white/80">{t("pilot.joinBody")}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/sign-up" className={buttonClass("light", "lg")}>{t("pilot.join")}</Link>
              <Link href="/preview" className={buttonClass("glass", "lg")}>{t("pilot.demo")}</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="overflow-x-clip">
      <section className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-14 lg:pt-20">
        <header className="mx-auto grid max-w-2xl gap-4 text-center">
          <h1 className="display text-4xl sm:text-5xl">{t("title")}</h1>
          <p className="text-lg text-muted">{t("body", { days: TRIAL_DAYS })}</p>
        </header>
        <PricingPlans />
        <p className="mx-auto max-w-2xl text-center text-sm text-muted">{t("messagesNote")}</p>
      </section>

      {/* Every plan side by side. On phones the table scrolls inside its own box, never the page. */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-20">
          <h2 className="display text-3xl">{t("compareTitle")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">{t("compareTitle")}</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-3 pe-4 text-start font-medium text-muted">{t("feature")}</th>
                  {PLANS.map((p) => (
                    <th key={p.key} scope="col" className="w-28 px-2 py-3 text-center font-semibold">{b(`plans.${p.key}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <th scope="row" className="py-3 pe-4 text-start font-normal">{t("aiCredits")}</th>
                  {PLANS.map((p) => (
                    <td key={p.key} className="px-2 py-3 text-center tabular-nums">{p.credits.toLocaleString("en")}</td>
                  ))}
                </tr>
                {ROWS.map((f) => (
                  <tr key={f} className="border-b border-border last:border-0">
                    <th scope="row" className="py-3 pe-4 text-start font-normal">{b(`features.${f}`)}</th>
                    {PLANS.map((p) => (
                      <td key={p.key} className="px-2 py-3 text-center">
                        {p.features.includes(f) ? (
                          <Check size={18} className="mx-auto text-primary" aria-label={t("included")} />
                        ) : (
                          <Minus size={18} className="mx-auto text-muted" aria-label={t("notIncluded")} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-24">
        <h2 className="display text-3xl sm:text-4xl">{t("faqTitle")}</h2>
        <div className="grid gap-x-10 md:grid-cols-2">
          {FAQ.map((k) => (
            <details key={k} className="group border-b border-border">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {t(`faq.${k}.q`)}
                <span aria-hidden="true" className="text-xl text-muted transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none">+</span>
              </summary>
              <p className="pb-5 text-muted">{t(`faq.${k}.a`, { days: TRIAL_DAYS })}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="bg-hero mx-auto grid max-w-7xl gap-6 rounded-[var(--radius-panel)] px-6 py-14 text-white md:grid-cols-[1fr_auto] md:items-center md:px-12">
          <div className="grid gap-2">
            <h2 className="display text-3xl">{t("finalTitle")}</h2>
            <p className="text-white/80">{t("finalBody", { days: TRIAL_DAYS })}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className={buttonClass("light", "lg")}>{t("cta", { days: TRIAL_DAYS })}</Link>
            <Link href="/preview" className={buttonClass("glass", "lg")}>{t("demo")}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
