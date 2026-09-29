import Link from "next/link";
import { MobileMenu } from "@/components/marketing/mobile-menu";
import { buttonClass } from "@/components/ui/button";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="text-lg font-semibold text-primary">Workspace</Link>
          <nav aria-label="Site" className="hidden items-center gap-6 md:flex">
            <Link href="/#how" className="text-muted hover:text-text">How it works</Link>
            <Link href="/demo" className="text-muted hover:text-text">Demo</Link>
            <Link href="/#pricing" className="text-muted hover:text-text">Pricing</Link>
            <Link href="/#questions" className="text-muted hover:text-text">Questions</Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden md:block">
              <Link href="/sign-in" className={buttonClass("ghost", "sm")}>Sign in</Link>
            </span>
            <Link href="/sign-up" className={buttonClass("primary", "sm")}>Start free trial</Link>
            <MobileMenu />
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div className="grid content-start gap-2">
            <p className="font-semibold text-primary">Workspace</p>
            <p className="text-sm text-muted">WhatsApp, email and customers in one place, for every manager. Made for businesses in the UAE.</p>
          </div>
          <nav aria-label="Product" className="grid content-start gap-2 text-sm">
            <p className="font-medium">Product</p>
            <Link href="/#how" className="text-muted hover:text-text">How it works</Link>
            <Link href="/demo" className="text-muted hover:text-text">Try the demo</Link>
            <Link href="/#pricing" className="text-muted hover:text-text">Pricing</Link>
          </nav>
          <nav aria-label="Legal" className="grid content-start gap-2 text-sm">
            <p className="font-medium">Legal</p>
            <Link href="/privacy" className="text-muted hover:text-text">Privacy policy</Link>
            <Link href="/terms" className="text-muted hover:text-text">Terms of service</Link>
            <Link href="/dpa" className="text-muted hover:text-text">Data processing agreement</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
