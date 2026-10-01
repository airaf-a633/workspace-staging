"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/i18n/client";

const LINKS = [
  ["/#how", "how"],
  ["/demo", "demo"],
  ["/#pricing", "pricing"],
  ["/#questions", "questions"],
] as const;

/** Phone-only menu for the public site: a labelled button that opens the section links. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const t = useT("site");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-text hover:bg-surface-2"
      >
        {open ? <X size={22} aria-hidden="true" /> : <List size={22} aria-hidden="true" />}
        <span className="sr-only sm:not-sr-only">{t("menu")}</span>
      </button>
      {open && (
        <nav id="site-menu" aria-label={t("nav.label")} className="glass-light absolute inset-x-0 top-full mt-2 rounded-3xl shadow-[var(--shadow-2)]">
          <ul className="grid px-5 py-2">
            {LINKS.map(([href, key]) => (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)} className="flex min-h-12 items-center border-b border-border text-base last:border-0">{t(`nav.${key}`)}</Link>
              </li>
            ))}
            <li>
              <Link href="/sign-in" onClick={() => setOpen(false)} className="flex min-h-12 items-center text-base text-primary">{t("signIn")}</Link>
            </li>
            <li className="border-t border-border py-3">
              <LanguageSwitch />
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
