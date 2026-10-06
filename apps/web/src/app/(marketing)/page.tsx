import Link from "next/link";
import { ArrowsLeftRight, ChartBar, Check, ChatsCircle, Lightning, MagnifyingGlass, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { CHANNELS } from "@/components/channels/catalog";
import { ChannelMark } from "@/components/channels/channel-mark";
import { HandoffDemo } from "@/components/marketing/handoff-demo";
import { HeroInbox } from "@/components/marketing/hero-inbox";
import { ManagerHomesPreview } from "@/components/marketing/manager-homes-preview";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";

/*
 * Relay landing page (rebrand 2026-10-07). Calm and product-led: the product itself is the visual
 * (live components, not pictures of them), one accent, no eyebrows, every section a different layout.
 */
export async function generateMetadata() {
  const t = await getT("landing");
  const meta = await getT("meta");
  return { title: { absolute: `${meta("name")}: ${t("metaTitle")}` }, description: t("metaDescription") };
}

const FAQ = ["channels", "phone", "price", "ai", "data", "cancel"] as const;
const POINTS = ["note", "trail", "one"] as const;

export default async function Landing() {
  const t = await getT("landing");

  return (
    <main className="overflow-x-clip">
      {/* 1. Hero: the promise on the left, a working inbox on the right. */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pb-28 lg:pt-20">
        <div className="grid content-center gap-6">
          <h1 className="display text-4xl sm:text-5xl lg:text-6xl">{t("hero.title")}</h1>
          <p className="max-w-[46ch] text-lg text-muted">{t("hero.body")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className={buttonClass("primary", "lg")}>{t("hero.start")}</Link>
            <Link href="/preview" className={buttonClass("secondary", "lg")}>{t("hero.demo")}</Link>
          </div>
        </div>
        <div>
          <HeroInbox />
        </div>
      </section>

      {/* 2. Channels: the marks only, named on hover and for screen readers. */}
      <section id="channels" className="scroll-mt-24 border-y border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="grid gap-3">
            <h2 className="display text-3xl sm:text-4xl">{t("channels.title")}</h2>
            <p className="max-w-[44ch] text-muted">{t("channels.body")}</p>
          </div>
          <ul className="reveal grid grid-cols-6 gap-4 sm:grid-cols-9">
            {CHANNELS.map((c) => (
              <li key={c.key} className="grid place-items-center">
                <ChannelMark ch={c.key} size={44} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. Manager homes: one full-width, working preview under a stacked heading. */}
      <section className="mx-auto grid max-w-5xl gap-10 px-4 py-24">
        <div className="grid max-w-2xl gap-3">
          <h2 className="display text-3xl sm:text-4xl">{t("homes.title")}</h2>
          <p className="text-muted">{t("homes.body")}</p>
        </div>
        <div className="reveal shadow-[var(--shadow-float)]">
          <ManagerHomesPreview />
        </div>
      </section>

      {/* 4. Handoff: the live demo leads, the explanation follows. */}
      <section className="bg-surface-2">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="reveal order-2 lg:order-1">
            <HandoffDemo fixed />
          </div>
          <div className="order-1 grid gap-5 lg:order-2">
            <h2 className="display text-3xl sm:text-4xl">{t("handoff.title")}</h2>
            <p className="text-muted">{t("handoff.body")}</p>
            <ul className="grid gap-3">
              {POINTS.map((k) => (
                <li key={k} className="flex gap-3">
                  <Check size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  {t(`handoff.points.${k}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Everything around the conversation: five cells, each with its own small, real piece of product. */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-24">
        <h2 className="display max-w-2xl text-3xl sm:text-4xl">{t("bento.title")}</h2>
        <div className="reveal grid gap-4 md:grid-cols-6">
          <article className="grid content-between gap-8 rounded-[var(--radius-panel)] bg-ai-soft p-6 md:col-span-4 md:row-span-2">
            <div className="grid gap-2">
              <Sparkle size={24} weight="fill" className="text-ai" aria-hidden="true" />
              <h3 className="text-xl font-semibold">{t("bento.ai.title")}</h3>
              <p className="max-w-[48ch] text-muted">{t("bento.ai.body")}</p>
            </div>
            <div className="grid max-w-md gap-2 rounded-[var(--radius-panel)] border border-ai/30 bg-surface p-4 text-sm">
              <span className="flex items-center gap-1 text-xs font-medium text-ai"><Sparkle size={12} weight="fill" aria-hidden="true" /> AI</span>
              <span>{t("heroInbox.replies.sales")}</span>
            </div>
          </article>
          <article className="grid content-between gap-6 rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:col-span-2">
            <div className="grid gap-2">
              <h3 className="font-semibold">{t("bento.help.title")}</h3>
              <p className="text-sm text-muted">{t("bento.help.body")}</p>
            </div>
            <span className="flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm text-muted">
              <MagnifyingGlass size={16} aria-hidden="true" /> {t("bento.helpSearch")}
            </span>
          </article>
          <article className="grid content-between gap-6 rounded-[var(--radius-panel)] bg-primary p-6 text-on-primary md:col-span-2">
            <div className="grid gap-2">
              <h3 className="font-semibold">{t("bento.widget.title")}</h3>
              <p className="text-sm opacity-85">{t("bento.widget.body")}</p>
            </div>
            <span className="flex items-center gap-2 justify-self-end">
              <span className="rounded-[var(--radius-panel)] rounded-ee-sm bg-surface px-3 py-2 text-sm text-text">{t("bento.widgetGreeting")}</span>
              <span className="grid size-11 place-items-center rounded-full bg-surface text-primary"><ChatsCircle size={22} weight="fill" aria-hidden="true" /></span>
            </span>
          </article>
          <article className="grid content-between gap-6 rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:col-span-3">
            <div className="grid gap-2">
              <ChartBar size={22} className="text-primary" aria-hidden="true" />
              <h3 className="font-semibold">{t("bento.reports.title")}</h3>
              <p className="text-sm text-muted">{t("bento.reports.body")}</p>
            </div>
            <p className="grid">
              <span className="display text-4xl">6 min</span>
              <span className="text-xs text-muted">{t("bento.reportsLabel")}</span>
            </p>
          </article>
          <article className="grid content-between gap-6 rounded-[var(--radius-panel)] bg-surface-2 p-6 md:col-span-3">
            <div className="grid gap-2">
              <Lightning size={22} weight="fill" className="text-primary" aria-hidden="true" />
              <h3 className="font-semibold">{t("bento.rules.title")}</h3>
              <p className="text-sm text-muted">{t("bento.rules.body")}</p>
            </div>
            <p className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm">{t("bento.rulesExample")}</p>
          </article>
        </div>
      </section>

      {/* 6. Languages: a short statement beside a real right-to-left conversation. */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-20 md:grid-cols-2">
          <div className="grid gap-3">
            <h2 className="display text-3xl">{t("languages.title")}</h2>
            <p className="text-muted">{t("languages.body")}</p>
          </div>
          <div dir="rtl" lang="ar" className="reveal grid gap-3 rounded-[var(--radius-panel)] border border-border bg-bg p-5">
            <p className="flex items-center gap-2 font-semibold"><ChannelMark ch="whatsapp" size={18} /> مريم السويدي</p>
            <p className="justify-self-start rounded-[var(--radius-panel)] border border-border bg-surface px-4 py-2">هل يمكنكم خصم 10٪ على 12 جهازًا؟</p>
            <p className="justify-self-end rounded-[var(--radius-panel)] bg-primary-soft px-4 py-2">أهلًا مريم، أفضل ما نقدمه خصم 8٪.</p>
          </div>
        </div>
      </section>

      {/* 7. Questions. */}
      <section id="questions" className="mx-auto grid max-w-5xl scroll-mt-24 gap-8 px-4 py-24">
        <h2 className="display text-3xl sm:text-4xl">{t("faq.title")}</h2>
        <div className="grid gap-x-10 md:grid-cols-2">
          {FAQ.map((k) => (
            <details key={k} className="group border-b border-border">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {t(`faq.items.${k}.q`)}
                <span aria-hidden="true" className="text-xl text-muted transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <p className="pb-5 text-muted">{t(`faq.items.${k}.a`)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 8. Closing call to action on the one brand surface. */}
      <section className="px-4 pb-24">
        <div className="bg-hero mx-auto grid max-w-7xl gap-6 rounded-[var(--radius-panel)] px-6 py-16 text-white md:grid-cols-[1fr_auto] md:items-center md:px-12">
          <div className="grid gap-2">
            <h2 className="display text-3xl sm:text-4xl">{t("final.title")}</h2>
            <p className="text-white/80">{t("final.body")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className={buttonClass("light", "lg")}>{t("hero.start")}</Link>
            <Link href="/preview" className={buttonClass("glass", "lg")}>
              <ArrowsLeftRight size={18} aria-hidden="true" /> {t("hero.demo")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
