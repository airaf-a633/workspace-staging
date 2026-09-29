import Link from "next/link";
import { MobileMenu } from "@/components/marketing/mobile-menu";
import { RevealOnScroll } from "@/components/marketing/reveal";
import { buttonClass } from "@/components/ui/button";

const NAV = [
  ["/#how", "How it works"],
  ["/demo", "Demo"],
  ["/#pricing", "Pricing"],
  ["/#questions", "Questions"],
] as const;

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="force-light flex min-h-dvh flex-col bg-bg text-text">
      {/* Floating glass pill, over the hero on the landing page and over the page elsewhere. */}
      <header className="fixed inset-x-0 top-3 z-30 px-3">
        <div className="glass-light relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 rounded-full ps-6 pe-2 shadow-[var(--shadow-2)]">
          <Link href="/" className="font-serif text-2xl tracking-tight text-text">Workspace</Link>
          <nav aria-label="Site" className="hidden items-center gap-7 md:flex">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="text-[15px] text-muted transition-colors hover:text-text">{label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <span className="hidden md:block">
              <Link href="/sign-in" className={buttonClass("ghost", "sm")}>Sign in</Link>
            </span>
            <Link href="/sign-up" className={buttonClass("primary", "sm")}>Start free trial</Link>
            <MobileMenu />
          </div>
        </div>
      </header>

      <div className="flex-1 pt-24">{children}</div>

      <footer className="bg-hero text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-16 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="grid content-start gap-3">
            <p className="font-serif text-4xl tracking-tight">Workspace</p>
            <p className="max-w-sm text-white/80">WhatsApp, email and customers in one place, for every manager. Made for businesses in the UAE.</p>
          </div>
          <nav aria-label="Product" className="grid content-start gap-2 text-sm">
            <p className="font-medium">Product</p>
            <Link href="/#how" className="text-white/80 hover:text-white">How it works</Link>
            <Link href="/demo" className="text-white/80 hover:text-white">Try the demo</Link>
            <Link href="/#pricing" className="text-white/80 hover:text-white">Pricing</Link>
            <Link href="/preview" className="text-white/80 hover:text-white">Preview the app</Link>
          </nav>
          <nav aria-label="Legal" className="grid content-start gap-2 text-sm">
            <p className="font-medium">Legal</p>
            <Link href="/privacy" className="text-white/80 hover:text-white">Privacy policy</Link>
            <Link href="/terms" className="text-white/80 hover:text-white">Terms of service</Link>
            <Link href="/dpa" className="text-white/80 hover:text-white">Data processing agreement</Link>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl border-t border-white/15 px-4 py-6 text-sm text-white/70">Official WhatsApp Business Platform. Data stored in Frankfurt, Germany.</p>
      </footer>
      <RevealOnScroll />
    </div>
  );
}
