import Link from "next/link";
import { ArrowRight, ArrowsLeftRight, Check, UsersThree, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { HandoffDemo } from "@/components/marketing/handoff-demo";
import { ManagerHomesPreview } from "@/components/marketing/manager-homes-preview";
import { PhotoSlot } from "@/components/marketing/photo-slot";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getT("landing");
  const meta = await getT("meta");
  return { title: { absolute: `${meta("name")}: ${t("metaTitle")}` }, description: t("metaDescription") };
}

const FACTS = [["0%", "markup"], ["1", "number"], ["2", "languages"], ["14", "days"]] as const;
const EVERYTHING = ["customers", "tasks", "email", "store", "ai", "campaigns", "automations", "reports"] as const;
const PLANS = [
  { key: "starter", price: "99", extras: 3 },
  { key: "growth", price: "249", extras: 4, featured: true },
  { key: "business", price: "499", extras: 3 },
] as const;
const FAQ = ["fees", "phone", "when", "banned", "gmail", "data", "cancel"] as const;
const STEPS = [
  { Icon: WhatsappLogo, key: "connect" },
  { Icon: UsersThree, key: "invite" },
  { Icon: ArrowsLeftRight, key: "together" },
] as const;
const POINTS = ["owner", "money", "branches"] as const;
const PROBLEMS = ["phone", "who", "split"] as const;

export default async function Landing() {
  const t = await getT("landing");
  const site = await getT("site");
  return (
    <main className="overflow-x-clip">
      {/* 1. Hero: atmosphere, a photo of the people, and the real product on top of it. */}
      <section className="bg-hero drift -mt-24 rounded-b-[2.5rem] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-36 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-44">
          <div className="grid gap-7">
            <h1 className="display text-5xl sm:text-6xl lg:text-7xl">{t("hero.title")}</h1>
            <p className="display text-2xl text-white/90 sm:text-3xl">{t("hero.tagline")}</p>
            <p className="max-w-lg text-lg text-white/85">{t("hero.body")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-up" className={buttonClass("light", "lg")}>{site("startTrial")}</Link>
              <Link href="/demo" className={buttonClass("glass", "lg")}>{site("tryDemo")}</Link>
            </div>
            <p className="text-sm text-white/75">{t("hero.trial")}</p>
          </div>

          <div className="relative lg:ps-6">
            <PhotoSlot
              src="/img/hero-owner.jpg"
              alt={t("hero.photoAlt")}
              brief={t("hero.photoAlt")}
              className="aspect-[4/5] rounded-[2rem] sm:aspect-[5/4] lg:aspect-[4/5]"
            />
            {/* One quiet product moment on the photo (decided 2026-09-30); the interactive demo has its own section. */}
            <div className="glass-light absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-2xl p-4 text-text shadow-[var(--shadow-float)] sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-80 lg:-start-8 lg:end-auto">
              <span className="bg-button grid size-10 shrink-0 place-items-center rounded-full text-white"><ArrowsLeftRight size={20} aria-hidden="true" /></span>
              <span className="grid gap-0.5">
                <span className="text-sm font-semibold">{t("hero.cardTitle")}</span>
                <span className="text-sm text-muted">{t("hero.cardNote")}</span>
                <span className="text-xs text-muted">{t("hero.cardMeta")}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Facts we can stand behind (no invented customer numbers before launch). */}
      <section className="mx-auto max-w-6xl px-4 py-20 lg:pt-28">
        <dl className="reveal grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map(([n, k]) => (
            <div key={k} className="grid content-start gap-2 border-t border-border pt-5">
              <dt className="display text-6xl text-primary" dir="ltr">{n}</dt>
              <dd className="text-muted">{t(`facts.${k}`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 2b. Try a handoff: the live demo, at a fixed height so opening the form never moves the page. */}
      <section className="bg-soft">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 lg:grid-cols-[1fr_1.1fr]">
          <div className="reveal grid gap-5">
            <h2 className="display text-4xl sm:text-5xl">{t("handoff.title")}</h2>
            <p className="text-lg text-muted">{t("handoff.body")}</p>
            <p className="text-muted">{t("handoff.try")}</p>
          </div>
          <div className="reveal shadow-[var(--shadow-float)]">
            <HandoffDemo fixed />
          </div>
        </div>
      </section>

      {/* 3. The problem, as a statement */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-24 md:grid-cols-[1fr_1.4fr]">
        <h2 className="display reveal text-4xl sm:text-5xl">{t("problem.title")}</h2>
        <ul className="reveal grid gap-6 text-xl sm:text-2xl">
          {PROBLEMS.map((k) => <li key={k} className="border-b border-border pb-6 last:border-0 last:pb-0">{t(`problem.${k}`)}</li>)}
        </ul>
      </section>

      {/* 4. How it works, on the soft petrol-mint wash */}
      <section id="how" className="bg-soft scroll-mt-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24">
          <div className="reveal grid max-w-2xl gap-3">
            <h2 className="display text-4xl sm:text-5xl">{t("how.title")}</h2>
            <p className="text-lg text-muted">{t("how.body")}</p>
          </div>
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map(({ Icon, key }, i) => (
              <li key={key} className="glass-light reveal grid content-start gap-4 rounded-[var(--radius-panel)] p-7 shadow-[var(--shadow-1)]" style={{ transitionDelay: `${i * 90}ms` }}>
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-full bg-button text-on-primary"><Icon size={24} aria-hidden="true" /></span>
                  <span className="display text-5xl text-primary/40" dir="ltr">0{i + 1}</span>
                </div>
                <h3 className="text-xl font-semibold">{t(`how.steps.${key}.title`)}</h3>
                <p className="text-muted">{t(`how.steps.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. Manager homes */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 lg:grid-cols-2">
        <div className="reveal grid gap-5">
          <h2 className="display text-4xl sm:text-5xl">{t("homes.title")}</h2>
          <p className="text-lg text-muted">{t("homes.body")}</p>
          <ul className="grid gap-3">
            {POINTS.map((k) => (
              <li key={k} className="flex gap-3"><Check size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{t(`homes.points.${k}`)}</li>
            ))}
          </ul>
          <Link href="/preview" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
            {t("homes.walk")} <ArrowRight size={18} className="rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
        <div className="reveal relative">
          <div className="absolute -inset-3 -z-10 rounded-[2.5rem] bg-soft sm:-inset-6" aria-hidden="true" />
          <div className="shadow-[var(--shadow-float)]"><ManagerHomesPreview /></div>
        </div>
      </section>

      {/* 6. Everything else */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-24">
        <h2 className="display reveal max-w-3xl text-4xl sm:text-5xl">{t("everything.title")}</h2>
        <dl className="reveal grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {EVERYTHING.map((k) => (
            <div key={k} className="grid content-start gap-2 border-t border-border pt-5">
              <dt className="font-semibold">{t(`everything.items.${k}.title`)}</dt>
              <dd className="text-muted">{t(`everything.items.${k}.body`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 7. Arabic */}
      <section className="px-3">
        <div className="bg-hero drift mx-auto grid max-w-6xl items-center gap-10 rounded-[2.5rem] px-6 py-16 text-white md:grid-cols-2 md:px-12">
          <div className="reveal grid gap-4">
            <h2 className="display text-4xl sm:text-5xl">{t("arabic.title")}</h2>
            <p className="text-lg text-white/85">{t("arabic.body")}</p>
          </div>
          <div dir="rtl" lang="ar" className="reveal grid gap-3 rounded-[var(--radius-panel)] bg-surface p-6 text-text shadow-[var(--shadow-float)]">
            <p className="font-semibold">مريم السويدي</p>
            <p className="justify-self-start rounded-[var(--radius-panel)] border border-border bg-surface px-4 py-2">هل يمكنكم خصم 10٪ على 12 جهازًا؟</p>
            <p className="justify-self-end rounded-[var(--radius-panel)] bg-primary-soft px-4 py-2">أهلًا مريم، أفضل ما نقدمه خصم 8٪.</p>
          </div>
        </div>
      </section>

      {/* 8. Pricing (placeholder, labelled) */}
      <section id="pricing" className="mx-auto grid max-w-6xl scroll-mt-24 gap-10 px-4 py-24">
        <div className="reveal grid max-w-2xl gap-3">
          <h2 className="display text-4xl sm:text-5xl">{t("pricing.title")}</h2>
          <p className="text-lg text-muted">{t("pricing.body")} <strong className="font-medium text-text">{t("pricing.beta")}</strong></p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <div
              key={p.key}
              style={{ transitionDelay: `${i * 90}ms` }}
              className={`reveal grid content-start gap-6 rounded-[var(--radius-panel)] p-7 ${"featured" in p ? "bg-hero text-white shadow-[var(--shadow-float)]" : "border border-border bg-surface"}`}
            >
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-semibold">{t(`pricing.plans.${p.key}.name`)}</h3>
                  {"featured" in p && p.featured && <span className="glass rounded-full px-3 py-0.5 text-sm">{t("pricing.mostTeams")}</span>}
                </div>
                <p className="flex items-baseline gap-2">
                  <span className="display text-5xl">{t("pricing.price", { price: p.price })}</span>
                  <span className={"featured" in p ? "text-white/75" : "text-muted"}>{t("pricing.perMonth")}</span>
                </p>
                <p className={`text-sm ${"featured" in p ? "text-white/80" : "text-muted"}`}>{t(`pricing.plans.${p.key}.size`)}</p>
              </div>
              <ul className="grid gap-2.5">
                {Array.from({ length: p.extras }, (_, i) => (
                  <li key={i} className="flex gap-2"><Check size={20} className={`mt-0.5 shrink-0 ${"featured" in p ? "text-[#8FD9D0]" : "text-primary"}`} aria-hidden="true" />{t(`pricing.plans.${p.key}.extras.${i}` as "pricing.plans.starter.extras.0")}</li>
                ))}
              </ul>
              <Link href="/sign-up" className={buttonClass("featured" in p ? "light" : "secondary", "md", "mt-auto")}>{site("startTrial")}</Link>
            </div>
          ))}
        </div>
        <p className="reveal text-muted">{t.rich("pricing.orders", { pack: <strong className="font-medium text-text">{t("pricing.ordersPack")}</strong> })}</p>
      </section>

      {/* 9. Questions */}
      <section id="questions" className="bg-soft scroll-mt-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 md:grid-cols-[1fr_1.6fr]">
          <h2 className="display reveal text-4xl sm:text-5xl">{t("faq.title")}</h2>
          <div className="reveal grid gap-3">
            {FAQ.map((k) => (
              <details key={k} className="glass-light group rounded-[var(--radius-panel)]">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 font-medium [&::-webkit-details-marker]:hidden">
                  {t(`faq.items.${k}.q`)}
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-lg text-primary transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 text-muted">{t(`faq.items.${k}.a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 10. Final call to action */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-28">
        <h2 className="display reveal max-w-4xl text-5xl sm:text-7xl lg:text-8xl">{t("final")}</h2>
        <div className="reveal flex flex-wrap gap-3">
          <Link href="/sign-up" className={buttonClass("primary", "lg")}>{site("startTrial")}</Link>
          <Link href="/demo" className={buttonClass("secondary", "lg")}>{site("tryDemo")}</Link>
        </div>
      </section>
    </main>
  );
}
