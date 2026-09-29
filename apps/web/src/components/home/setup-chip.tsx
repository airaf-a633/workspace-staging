"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, X } from "@phosphor-icons/react";

/**
 * "Setup 2 of 5" on the owner's Home. Dismissing hides it for good in this browser; the checklist stays in
 * Settings › Account (decided 2026-09-30). The real app will store the choice on the member.
 */
const KEY = "setup-chip-dismissed";
const listeners = new Set<() => void>();
let hidden = false;

function read() {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function dismiss() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* storage blocked: hide for this page view only */
  }
  hidden = true;
  listeners.forEach((fn) => fn());
}

export function SetupChip({ done, total, href }: { done: number; total: number; href: string }) {
  const dismissed = useSyncExternalStore(subscribe, () => hidden || read(), () => false);
  if (dismissed || done >= total) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">
      <Link href={href} className="inline-flex min-h-9 items-center gap-2 rounded-s-full ps-3.5 pe-2 text-sm hover:bg-surface-2">
        <span className="font-medium">Setup {done} of {total}</span>
        <span className="text-muted">Finish setting up</span>
        <ArrowRight size={14} className="text-muted rtl:rotate-180" aria-hidden="true" />
      </Link>
      <button type="button" onClick={dismiss} className="grid min-h-9 w-9 place-items-center rounded-e-full border-s border-border text-muted hover:bg-surface-2 hover:text-text" aria-label="Hide setup reminder" title="Hide. The checklist stays in Settings › Account.">
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}
