import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOut, Check } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";
import { CHECKED_ON, RIVALS, rival, type RivalKey } from "@/lib/competitors";
import { PLANS, TRIAL_DAYS, yearlyMonthly } from "@/lib/plans";

export function generateStaticParams() {
  return RIVALS.map((r) => ({ rival: r.key }));
}

export async function generateMetadata(props: PageProps<"/compare/[rival]">) {
  const r = rival((await props.params).rival);
  if (!r) return {};
  const t = await getT("compare");
  // Built as plain text: interpolated names carry invisible direction marks, which titles and snippets must not.
  return { title: `Relay vs ${r.name}`, description: t(`rivals.${r.key}.summary`) };
}

const POINTS = ["one", "two", "three"] as const;
const dollars = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/*
 * Relay vs a competitor (2026-10-19). Honest by design: their published prices with the date we checked them,
 * where they're a good fit, and why teams pick Relay instead. Never claims about features we haven't verified.
 */
export default async function Compare(props: PageProps<"/compare/[rival]">) {
  const r = rival((await props.params).rival);
  if (!r) notFound();
  const key: RivalKey = r.key;
  const t = await getT("compare");
  const b = await getT("billing");
  const checked = new Date(`${CHECKED_ON}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const billedNote = r.billing === "annual" ? t("annualNote") : t("monthlyNote");

  return (
    <main className="overflow-x-clip">
      <header className="mx-auto grid max-w-3xl gap-5 px-4 pb-14 pt-14 text-center lg:pt-20">
        <h1 className="display text-4xl sm:text-5xl">Relay vs {r.name}</h1>
        <p className="text-lg text-muted">{t(`rivals.${key}.summary`)}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className={buttonClass("primary", "lg")}>{t("start", { days: TRIAL_DAYS })}</Link>
          <Link href="/preview" className={buttonClass("secondary", "lg")}>{t("demo")}</Link>
        </div>
      </header>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-16">
          <h2 className="display text-3xl">{t("pricesTitle")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <caption className="sr-only">{t("pricesTitle")}</caption>
              <thead>
                <tr className="border-b border-border text-muted">
                  <th scope="col" className="py-3 pe-4 text-start font-medium">{t("tier")}</th>
                  <th scope="col" className="px-3 py-3 text-start font-semibold text-text">Relay</th>
                  <th scope="col" className="px-3 py-3 text-start font-semibold text-text">{r.name}</th>
                </tr>
              </thead>
              <tbody>
                {(["entry", "middle", "top"] as const).map((tier, i) => {
                  const ours = PLANS[i];
                  const theirs = r.plans[i];
                  return (
                    <tr key={tier} className="border-b border-border last:border-0">
                      <th scope="row" className="py-4 pe-4 text-start font-normal text-muted">{t(`tiers.${tier}`)}</th>
                      <td className="px-3 py-4">
                        <span className="font-semibold">{b(`plans.${ours.key}`)}</span>{" "}
                        <span className="tabular-nums">{t("perUser", { price: dollars(ours.price) })}</span>
                        <span className="block text-xs text-muted">{t("oursYearly", { price: dollars(yearlyMonthly(ours.price)) })}</span>
                      </td>
                      <td className="px-3 py-4">
                        <span className="font-semibold">{theirs.name}</span>{" "}
                        <span className="tabular-nums">{theirs.price === null ? t("contactSales") : t("perUser", { price: dollars(theirs.price) })}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted">
            {t("sourceNote", { name: r.name, date: checked, billed: billedNote })}{" "}
            <a href={r.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
              {t("sourceLink", { name: r.name })} <ArrowSquareOut size={14} aria-hidden="true" />
            </a>
          </p>
          <p className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm">{t(`rivals.${key}.priceNote`)}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-10 px-4 py-20 md:grid-cols-2">
        <div className="grid content-start gap-4">
          <h2 className="display text-2xl">{t("fitTitle", { name: r.name })}</h2>
          <p className="text-muted">{t(`rivals.${key}.fit`)}</p>
        </div>
        <div className="grid content-start gap-4">
          <h2 className="display text-2xl">{t("whyTitle")}</h2>
          <ul className="grid gap-3">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3">
                <Check size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                {t(`rivals.${key}.why.${p}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 py-14">
          <h2 className="text-lg font-semibold">{t("othersTitle")}</h2>
          <ul className="flex flex-wrap gap-2">
            {RIVALS.filter((x) => x.key !== key).map((x) => (
              <li key={x.key}>
                <Link href={`/compare/${x.key}`} className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm hover:border-text">
                  Relay vs {x.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-24">
        <div className="bg-hero mx-auto grid max-w-7xl gap-6 rounded-[var(--radius-panel)] px-6 py-14 text-white md:grid-cols-[1fr_auto] md:items-center md:px-12">
          <div className="grid gap-2">
            <h2 className="display text-3xl">{t("finalTitle")}</h2>
            <p className="text-white/80">{t("finalBody", { days: TRIAL_DAYS })}</p>
          </div>
          <Link href="/sign-up" className={buttonClass("light", "lg")}>{t("start", { days: TRIAL_DAYS })}</Link>
        </div>
      </section>
    </main>
  );
}
