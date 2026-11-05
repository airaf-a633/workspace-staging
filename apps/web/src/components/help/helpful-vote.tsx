"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import type { HelpLang } from "./sample";
import { siteText } from "./site-text";

/** "Was this helpful?" on an article. A no answer offers the chat straight away. */
export function HelpfulVote({ lang }: { lang: HelpLang }) {
  const s = siteText(lang);
  const [vote, setVote] = useState<"yes" | "no" | null>(null);
  if (vote) return <p role="status" className="text-sm text-muted">{vote === "yes" ? s("thanks") : s("sorry")}</p>;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="font-medium">{s("helpful")}</span>
      {(["yes", "no"] as const).map((v) => (
        <button key={v} type="button" onClick={() => setVote(v)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3.5 hover:bg-surface-2">
          {v === "yes" ? <ThumbsUp size={16} aria-hidden="true" /> : <ThumbsDown size={16} aria-hidden="true" />} {s(v)}
        </button>
      ))}
    </div>
  );
}
