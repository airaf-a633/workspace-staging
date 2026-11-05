"use client";

import { useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { ChannelMark } from "@/components/channels/channel-mark";
import type { ChannelKey } from "@/components/channels/catalog";
import { useT } from "@/i18n/client";

/*
 * The hero's product moment (Relay v1): a small working inbox, not a picture. Six real-looking customers
 * across six channels; the filter chips work, and the open chat shows Relay's AI suggestion.
 * Customer messages are sample content and stay as written in every language.
 */
interface Row {
  id: string;
  ch: ChannelKey;
  name: string;
  preview: string;
  time: string;
  unread?: number;
  owner: "sales" | "support" | "ops";
}

const ROWS: Row[] = [
  { id: "mariam", ch: "whatsapp", name: "Mariam Al Suwaidi", preview: "Can you do 10% off for 12 laptops?", time: "09:24", unread: 2, owner: "sales" },
  { id: "lukas", ch: "email", name: "Lukas Weber", preview: "Re: Invoice INV-2207 for Q3 hardware", time: "09:11", owner: "ops" },
  { id: "sofia", ch: "instagram", name: "Sofia Martins", preview: "Do you ship to Lisbon?", time: "08:57", unread: 1, owner: "sales" },
  { id: "daniel", ch: "webchat", name: "Daniel Okafor", preview: "My order says delivered but it isn't here", time: "08:40", unread: 3, owner: "support" },
  { id: "aiko", ch: "line", name: "Aiko Tanaka", preview: "Thank you! The adapter works now", time: "Yesterday", owner: "support" },
  { id: "omar", ch: "telegram", name: "Omar Haddad", preview: "Is the 16-inch model back in stock?", time: "Yesterday", owner: "sales" },
];

const FILTERS = ["all", "sales", "support", "ops"] as const;

export function HeroInbox() {
  const t = useT("landing");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [open, setOpen] = useState("daniel");
  const rows = ROWS.filter((r) => filter === "all" || r.owner === filter);
  const current = ROWS.find((r) => r.id === open) ?? ROWS[0]!;

  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[var(--shadow-float)]">
      <div className="grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="border-b border-border md:border-b-0 md:border-e">
          <div role="group" aria-label={t("heroInbox.filter")} className="flex gap-1 border-b border-border p-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-8 rounded-full px-3 text-xs font-medium transition-colors ${filter === f ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2"}`}
              >
                {t(`heroInbox.views.${f}`)}
              </button>
            ))}
          </div>
          <ul className="max-h-[22rem] overflow-y-auto p-1.5">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpen(r.id)}
                  aria-current={open === r.id ? "true" : undefined}
                  className={`flex w-full items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-2 text-start transition-colors ${open === r.id ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
                >
                  <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-hidden="true">
                    {r.name.charAt(0)}
                    <ChannelMark ch={r.ch} size={16} label={false} className="absolute -bottom-0.5 -end-0.5 ring-2 ring-surface" />
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <bdi className={`truncate text-sm ${r.unread ? "font-semibold" : "font-medium"}`}>{r.name}</bdi>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted">{r.time}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted" dir="auto">{r.preview}</span>
                      {r.unread && <span className="grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-on-primary">{r.unread}</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-h-[20rem] flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <ChannelMark ch={current.ch} size={18} />
            <bdi className="truncate text-sm font-semibold">{current.name}</bdi>
            <span className="ms-auto rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">{t(`heroInbox.views.${current.owner}`)}</span>
          </div>
          <div className="grid flex-1 content-start gap-2.5 bg-bg p-4">
            <p className="max-w-[85%] justify-self-start rounded-[var(--radius-panel)] rounded-es-sm border border-border bg-surface px-3 py-2 text-sm" dir="auto">{current.preview}</p>
            <div className="grid max-w-[90%] gap-1.5 justify-self-end rounded-[var(--radius-panel)] border border-ai/30 bg-ai-soft px-3 py-2 text-sm">
              <span className="flex items-center gap-1 text-[11px] font-medium text-ai">
                <Sparkle size={12} weight="fill" aria-hidden="true" /> {t("heroInbox.suggested")}
              </span>
              <span dir="auto">{t(`heroInbox.replies.${current.owner}`)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted">
            <span>{t("heroInbox.footer")}</span>
            <span className="rounded-[var(--radius-control)] bg-primary px-2.5 py-1 font-medium text-on-primary">{t("heroInbox.send")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
