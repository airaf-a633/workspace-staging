import Link from "next/link";
import { RelayLogo } from "@/components/brand/logo";
import { MobileMenu } from "@/components/marketing/mobile-menu";
import { RevealOnScroll } from "@/components/marketing/reveal";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";
import { RIVALS } from "@/lib/competitors";

/* Relay site chrome (2026-10-07): a solid, quiet header and footer. The product carries the page. */
export const SITE_NAV = [
  ["/features", "features"],
  ["/pricing", "pricing"],
  ["/preview", "demo"],
  ["/#questions", "questions"],
] as const;

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const t = await getT("site");
  return (
    <div className="force-light flex min-h-dvh flex-col bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4">
          <Link href="/" aria-label="Relay"><RelayLogo size={26} /></Link>
          <nav aria-label={t("nav.label")} className="hidden items-center gap-7 md:flex">
            {SITE_NAV.map(([href, key]) => (
              <Link key={href} href={href} className="text-[15px] text-muted transition-colors hover:text-text">{t(`nav.${key}`)}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className={buttonClass("ghost", "sm", "hidden md:inline-flex")}>{t("signIn")}</Link>
            <Link href="/sign-up" className={buttonClass("primary", "sm")}>{t("startTrial")}</Link>
            <MobileMenu />
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-10 pt-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="grid content-start gap-4">
            <RelayLogo size={24} />
            <p className="max-w-sm text-sm text-muted">{t("footer.about")}</p>
          </div>
          <nav aria-label={t("footer.product")} className="grid content-start gap-2 text-sm">
            <p className="font-medium">{t("footer.product")}</p>
            <Link href="/features" className="text-muted hover:text-text">{t("nav.features")}</Link>
            <Link href="/pricing" className="text-muted hover:text-text">{t("nav.pricing")}</Link>
            <Link href="/#channels" className="text-muted hover:text-text">{t("nav.channels")}</Link>
            <Link href="/demo" className="text-muted hover:text-text">{t("tryDemo")}</Link>
            <Link href="/preview" className="text-muted hover:text-text">{t("footer.preview")}</Link>
          </nav>
          <nav aria-label={t("footer.compare")} className="grid content-start gap-2 text-sm">
            <p className="font-medium">{t("footer.compare")}</p>
            {RIVALS.map((r) => (
              <Link key={r.key} href={`/compare/${r.key}`} className="text-muted hover:text-text">{t("footer.vs", { name: r.name })}</Link>
            ))}
          </nav>
          <nav aria-label={t("footer.legal")} className="grid content-start gap-2 text-sm">
            <p className="font-medium">{t("footer.legal")}</p>
            <Link href="/privacy" className="text-muted hover:text-text">{t("footer.privacy")}</Link>
            <Link href="/terms" className="text-muted hover:text-text">{t("footer.terms")}</Link>
            <Link href="/dpa" className="text-muted hover:text-text">{t("footer.dpa")}</Link>
          </nav>
        </div>
        <p className="mx-auto max-w-7xl border-t border-border px-4 py-6 text-sm text-muted">{t("footer.note")}</p>
      </footer>
      <RevealOnScroll />
    </div>
  );
}
