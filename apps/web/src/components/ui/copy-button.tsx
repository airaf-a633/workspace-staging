"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { buttonClass } from "./button";

/** Copies text; if the browser refuses, selects the text so the user can copy it themselves. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT("common");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()}
        dir="ltr" className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-mono text-sm" />
      <button
        type="button"
        className={buttonClass("secondary")}
        onClick={async (e) => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            (e.currentTarget.previousElementSibling as HTMLInputElement | null)?.select();
          }
        }}
      >
        {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
        {copied ? t("copied") : t("copyLink")}
      </button>
    </div>
  );
}
