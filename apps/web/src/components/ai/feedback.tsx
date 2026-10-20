"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { report } from "./store";

const REASONS = ["wrongFact", "wrongTone", "wrongLanguage", "other"] as const;

/**
 * 👍 / 👎 on any AI output (decided 2026-10-01). A thumbs-down asks for one optional reason; the owner
 * sees a weekly list in Settings › AI and can turn wrong facts into knowledge fixes.
 */
export function AiFeedback() {
  const t = useT("feedback");
  const [state, setState] = useState<"idle" | "up" | "asking" | "done">("idle");
  if (state === "up" || state === "done") return <span className="text-xs text-muted">{t("thanks")}</span>;
  if (state === "asking") {
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label={t("why")}>
        <span className="text-muted">{t("why")}</span>
        {REASONS.map((r) => (
          <button key={r} type="button" onClick={() => { report(r); setState("done"); }} className="rounded-full border border-border px-2 py-0.5 hover:bg-surface-2">
            {t(`reasons.${r}`)}
          </button>
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <button type="button" onClick={() => setState("up")} className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={t("good")} title={t("good")}>
        <ThumbsUp size={14} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => setState("asking")} className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={t("bad")} title={t("bad")}>
        <ThumbsDown size={14} aria-hidden="true" />
      </button>
    </span>
  );
}
