import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { MobileMenu } from "@/components/marketing/mobile-menu";
import { RevealOnScroll } from "@/components/marketing/reveal";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";

const NAV = [
  ["/#how", "how"],
  ["/demo", "demo"],
  ["/#pricing", "pricing"],
  ["/#questions", "questions"],
] as const;

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const t = await getT("site");
  const meta = await getT("meta");
  return (
    <div className="force-light flex min-h-dvh flex-col bg-bg text-text">
      {/* Floating glass pill, over the hero on the landing page and over the page elsewhere. */}
      <header className="fixed inset-x-0 top-3 z-30 px-3">
        <div className="glass-light relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 rounded-full ps-6 pe-2 shadow-[var(--shadow-2)]">
          <Link href="/" className="font-serif text-2xl tracking-tight text-text">{meta("name")}</Link>
          <nav aria-label={t("nav.label")} className="hidden items-center gap-7 md:flex">
            {NAV.map(([href, key]) => (
              <Link key={href} href={href} className="text-[15px] text-muted transition-colors hover:text-text">{t(`nav.${key}`)}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <span className="hidden md:block">
              <Link href="/sign-in" className={buttonClass("ghost", "sm")}>{t("signIn")}</Link>
            </span>
            <Link href="/sign-up" className={buttonClass("primary", "sm")}>{t("startTrial")}</Link>
            <MobileMenu />
          </div>
        </div>
      </header>

      <div className="flex-1 pt-24">{children}</div>

      <footer className="bg-hero text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-16 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="grid content-start gap-3">
            <p className="font-serif text-4xl tracking-tight">{meta("name")}</p>
            <p className="max-w-sm text-white/80">{t("footer.about")}</p>
            <LanguageSwitch tone="glass" className="mt-2" />
          </div>
          <nav aria-label={t("footer.product")} className="grid content-start gap-2 text-sm">
            <p className="font-medium">{t("footer.product")}</p>
            <Link href="/#how" className="text-white/80 hover:text-white">{t("nav.how")}</Link>
            <Link href="/demo" className="text-white/80 hover:text-white">{t("tryDemo")}</Link>
            <Link href="/#pricing" className="text-white/80 hover:text-white">{t("nav.pricing")}</Link>
            <Link href="/preview" className="text-white/80 hover:text-white">{t("footer.preview")}</Link>
          </nav>
          <nav aria-label={t("footer.legal")} className="grid content-start gap-2 text-sm">
            <p className="font-medium">{t("footer.legal")}</p>
            <Link href="/privacy" className="text-white/80 hover:text-white">{t("footer.privacy")}</Link>
            <Link href="/terms" className="text-white/80 hover:text-white">{t("footer.terms")}</Link>
            <Link href="/dpa" className="text-white/80 hover:text-white">{t("footer.dpa")}</Link>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl border-t border-white/15 px-4 py-6 text-sm text-white/70">{t("footer.note")}</p>
      </footer>
      <RevealOnScroll />
    </div>
  );
}
