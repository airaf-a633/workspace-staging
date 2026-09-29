"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";

const LINKS = [
  ["/#how", "How it works"],
  ["/demo", "Demo"],
  ["/#pricing", "Pricing"],
  ["/#questions", "Questions"],
] as const;

/** Phone-only menu for the public site: a labelled button that opens the section links. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
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
        <span className="sr-only sm:not-sr-only">Menu</span>
      </button>
      {open && (
        <nav id="site-menu" aria-label="Site" className="glass-light absolute inset-x-0 top-full mt-2 rounded-3xl shadow-[var(--shadow-2)]">
          <ul className="grid px-5 py-2">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)} className="flex min-h-12 items-center border-b border-border text-base last:border-0">{label}</Link>
              </li>
            ))}
            <li>
              <Link href="/sign-in" onClick={() => setOpen(false)} className="flex min-h-12 items-center text-base text-primary">Sign in</Link>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
