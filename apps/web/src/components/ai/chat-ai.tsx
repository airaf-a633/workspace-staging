"use client";

import { useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { useLocale, useT } from "@/i18n/client";
import { AiTag, CreditCost } from "./ai-tag";
import { AiFeedback } from "./feedback";
import { spend } from "./store";

/*
 * The small AI helpers inside a chat (decided 2026-10-01): each one runs only when clicked, shows its credit
 * cost first, and marks its output with the AI tag. Preview text is scripted; the real one is generated.
 */

const btn = "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-ai hover:bg-ai-soft";

/** "Summarise this chat" at the top of a thread: 2 credits, only the team sees it. */
export function ChatSummary({ conversationId, customer, messageCount }: { conversationId: string; customer: string; messageCount: number }) {
  const t = useT("aiChat");
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      <div className="mb-4 flex justify-center">
        <button type="button" onClick={() => { spend(2); setShown(true); }} className={btn}>
          <Sparkle size={16} weight="fill" aria-hidden="true" /> {t("summarise")} <CreditCost credits={2} />
        </button>
      </div>
    );
  }
  const text = t.has(`summaries.${conversationId}`) ? t(`summaries.${conversationId}` as "summaries.mariam") : t("summaryGeneric", { name: customer, count: messageCount });
  return (
    <div className="mb-6 grid gap-1.5 rounded-[var(--radius-panel)] border border-ai/30 bg-ai-soft/50 p-4">
      <p className="flex items-center justify-between gap-2 text-xs font-medium text-muted"><AiTag label={t("summaryTag")} /> {t("teamOnly")}</p>
      <p className="text-sm leading-relaxed">{text}</p>
      <span className="justify-self-end"><AiFeedback /></span>
    </div>
  );
}

/** "Translate" under a customer's message, into the reader's app language (1 credit). */
export function TranslateMessage({ translation }: { translation?: { en?: string; ar?: string } }) {
  const t = useT("aiChat");
  const locale = useLocale();
  const [shown, setShown] = useState(false);
  const text = translation?.[locale];
  if (!text) return null;
  return shown ? (
    <p className="grid gap-1 border-t border-border pt-1.5 text-sm text-muted" dir="auto"><AiTag label={t("translated")} />{text}</p>
  ) : (
    <button type="button" onClick={() => { spend(1); setShown(true); }} className="justify-self-start text-xs font-medium text-ai hover:underline">
      {t("translate")} · <CreditCost credits={1} />
    </button>
  );
}

/** "Transcribe" under a voice note (1 credit): the words, so nobody has to play it in a busy shop. */
export function Transcribe({ transcript }: { transcript?: string }) {
  const t = useT("aiChat");
  const [shown, setShown] = useState(false);
  if (!transcript) return null;
  return shown ? (
    <p className="grid gap-1 text-sm" dir="auto"><AiTag label={t("transcript")} />{transcript}</p>
  ) : (
    <button type="button" onClick={() => { spend(1); setShown(true); }} className="justify-self-start text-xs font-medium text-ai hover:underline">
      {t("transcribe")} · <CreditCost credits={1} />
    </button>
  );
}

/** The ✨ button for composers and the handover form. */
export function AiButton({ label, credits, onClick }: { label: string; credits: number; onClick: () => void }) {
  return (
    <button type="button" onClick={() => { spend(credits); onClick(); }} className={btn} title={label}>
      <Sparkle size={16} weight="fill" aria-hidden="true" /> {label} <CreditCost credits={credits} />
    </button>
  );
}
