"use client";

import { Sparkle } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";

/** The one mark every AI-made thing carries (decided 2026-10-01: clearly marked). */
export function AiTag({ label, className = "" }: { label?: string; className?: string }) {
  const t = useT("ai");
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-ai-soft px-2 py-0.5 text-xs font-medium text-ai ${className}`}>
      <Sparkle size={12} weight="fill" aria-hidden="true" />
      {label ?? t("tag")}
    </span>
  );
}

/** "· 1 credit": shown before an AI action runs, so the cost is never a surprise. */
export function CreditCost({ credits }: { credits: number }) {
  const t = useT("ai");
  return <span className="text-xs font-normal text-muted">{t("credits", { count: credits })}</span>;
}
