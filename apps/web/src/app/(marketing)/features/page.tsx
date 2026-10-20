import Link from "next/link";
import {
  ArrowsLeftRight,
  ChartBar,
  Check,
  ChatsCircle,
  Lifebuoy,
  Megaphone,
  ShieldCheck,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { CHANNELS } from "@/components/channels/catalog";
import { ChannelMark } from "@/components/channels/channel-mark";
import { HandoffDemo } from "@/components/marketing/handoff-demo";
import { ManagerHomesPreview } from "@/components/marketing/manager-homes-preview";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";
import { TRIAL_DAYS } from "@/lib/plans";

export async function generateMetadata() {
  const t = await getT("features");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/*
 * Features (2026-10-19): one section per job a team does, in the order a new customer meets them.
 * Where a real piece of the product can show it, the page uses it instead of a picture.
 */
type SectionKey = "inbox" | "handoff" | "homes" | "ai" | "sla" | "help" | "campaigns" | "security";
const SECTIONS: { key: SectionKey; Icon: Icon; demo?: "handoff" | "homes" | "channels" }[] = [
  { key: "inbox", Icon: ChatsCircle, demo: "channels" },
  { key: "handoff", Icon: ArrowsLeftRight, demo: "handoff" },
  { key: "homes", Icon: UsersThree, demo: "homes" },
  { key: "ai", Icon: Sparkle },
  { key: "sla", Icon: ChartBar },
  { key: "help", Icon: Lifebuoy },
  { key: "campaigns", Icon: Megaphone },
  { key: "security", Icon: ShieldCheck },
];
const POINTS = ["one", "two", "three"] as const;

export default async function Features() {
  const t = await getT("features");

  return (
    <main className="overflow-x-clip">
      <header className="mx-auto grid max-w-3xl gap-4 px-4 pb-12 pt-14 text-center lg:pt-20">
        <h1 className="display text-4xl sm:text-5xl">{t("title")}</h1>
        <p className="text-lg text-muted">{t("body")}</p>
        <nav aria-label={t("jump")} className="mt-4 flex flex-wrap justify-center gap-2">
          {SECTIONS.map(({ key }) => (
            <a key={key} href={`#${key}`} className="min-h-10 rounded-full border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-text hover:text-text">
              {t(`sections.${key}.nav`)}
            </a>
          ))}
        </nav>
      </header>

      {SECTIONS.map(({ key, Icon, demo }, i) => (
        <section key={key} id={key} className={`scroll-mt-24 ${i % 2 ? "bg-surface" : ""} border-t border-border`}>
          <div className={`mx-auto grid items-center gap-12 px-4 py-20 ${demo ? "max-w-7xl lg:grid-cols-2" : "max-w-3xl"}`}>
            <div className={`grid content-center gap-5 ${demo && i % 2 ? "lg:order-2" : ""}`}>
              <span className="grid size-11 place-items-center rounded-[var(--radius-control)] bg-primary-soft text-primary" aria-hidden="true">
                <Icon size={22} />
              </span>
              <h2 className="display text-3xl sm:text-4xl">{t(`sections.${key}.title`)}</h2>
              <p className="max-w-[52ch] text-muted">{t(`sections.${key}.body`)}</p>
              <ul className="grid gap-3">
                {POINTS.map((p) => (
                  <li key={p} className="flex gap-3">
                    <Check size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    {t(`sections.${key}.points.${p}`)}
                  </li>
                ))}
              </ul>
            </div>
            {demo === "handoff" && (
              <div className="reveal">
                <HandoffDemo fixed />
              </div>
            )}
            {demo === "homes" && (
              <div className="reveal shadow-[var(--shadow-float)]">
                <ManagerHomesPreview />
              </div>
            )}
            {demo === "channels" && (
              <ul className="reveal grid grid-cols-4 gap-5 rounded-[var(--radius-panel)] bg-surface p-8 ring-1 ring-border sm:grid-cols-6">
                {CHANNELS.map((c) => (
                  <li key={c.key} className="grid place-items-center">
                    <ChannelMark ch={c.key} size={40} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}

      <section className="px-4 py-24">
        <div className="bg-hero mx-auto grid max-w-7xl gap-6 rounded-[var(--radius-panel)] px-6 py-14 text-white md:grid-cols-[1fr_auto] md:items-center md:px-12">
          <div className="grid gap-2">
            <h2 className="display text-3xl">{t("finalTitle")}</h2>
            <p className="text-white/80">{t("finalBody", { days: TRIAL_DAYS })}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className={buttonClass("light", "lg")}>{t("start")}</Link>
            <Link href="/pricing" className={buttonClass("glass", "lg")}>{t("pricing")}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
