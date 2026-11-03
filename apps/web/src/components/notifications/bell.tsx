"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowsLeftRight, At, Bell, CheckCircle, Clock, CurrencyCircleDollar, ListChecks, PlugsConnected, UserPlus, XCircle } from "@phosphor-icons/react";
import { useFormat, useT } from "@/i18n/client";
import type { AppNotice, NoticeKind } from "./notifications";

const ICON: Record<NoticeKind, typeof Bell> = {
  handover: ArrowsLeftRight,
  mention: At,
  collabRequest: UserPlus,
  slaWarn: Clock,
  slaBreach: Clock,
  channelBroken: PlugsConnected,
  discountAsked: CurrencyCircleDollar,
  discountApproved: CheckCircle,
  discountDeclined: XCircle,
  taskAssigned: ListChecks,
  taskLate: Clock,
};
const TONE: Record<NoticeKind, string> = {
  handover: "bg-primary-soft text-primary",
  mention: "bg-primary-soft text-primary",
  collabRequest: "bg-primary-soft text-primary",
  slaWarn: "bg-warn-soft text-warn",
  slaBreach: "bg-fail-soft text-fail",
  channelBroken: "bg-fail-soft text-fail",
  discountAsked: "bg-primary-soft text-primary",
  discountApproved: "bg-primary-soft text-primary",
  discountDeclined: "bg-fail-soft text-fail",
  taskAssigned: "bg-primary-soft text-primary",
  taskLate: "bg-fail-soft text-fail",
};

/**
 * The bell (decided 2026-10-19). Shows how many things need you; opens a list that links straight to the chat.
 * `place` positions the list: beside the sidebar on desktop, under the top bar on phones.
 * In a real workspace `read` saves what was read (ids, or null for everything) and the list follows the server;
 * in the preview there is nothing to save, so reading only changes what this page shows.
 */
export function NotificationBell({
  initial,
  now,
  place,
  read,
}: {
  initial: AppNotice[];
  now: number;
  place: "sidebar" | "rail" | "phone";
  read?: (ids: string[] | null) => Promise<void>;
}) {
  const t = useT("notifications");
  const fmt = useFormat();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  // A real workspace follows the server's list (new notices arrive, other tabs mark things read).
  const [seen, setSeen] = useState(initial);
  if (read && seen !== initial) {
    setSeen(initial);
    setItems(initial);
  }
  const markRead = (ids: string[] | null) => {
    setItems((all) => all.map((n) => (ids === null || ids.includes(n.id) ? { ...n, read: true } : n)));
    if (read) void read(ids).then(() => router.refresh(), () => router.refresh());
  };
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const panel =
    place === "phone"
      ? "absolute inset-x-3 top-full mt-1 max-h-[70dvh]"
      : place === "rail"
        ? "absolute start-full top-0 ms-2 w-[22rem] max-h-[80dvh]"
        : "absolute start-0 top-full mt-2 w-[22rem] max-h-[80dvh]";

  return (
    <div ref={wrap} className={place === "phone" ? "" : "relative"}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={unread ? t("labelUnread", { count: unread }) : t("label")}
        title={t("label")}
        className="relative grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
      >
        <Bell size={22} weight={unread ? "fill" : "regular"} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute end-1 top-1 grid min-w-[1.125rem] place-items-center rounded-full bg-fail px-1 text-[0.6875rem] font-semibold leading-[1.125rem] text-white" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label={t("title")} className={`${panel} z-40 flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[var(--shadow-2)]`}>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="font-semibold">{t("title")}</h2>
            {unread > 0 && (
              <button type="button" onClick={() => markRead(null)} className="min-h-8 rounded px-2 text-sm text-primary hover:bg-surface-2">
                {t("markAll")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">{t("empty")}</p>
          ) : (
            <ul className="min-h-0 overflow-y-auto">
              {items.map((n) => {
                const Icon = ICON[n.kind];
                return (
                  <li key={n.id} className="border-b border-border last:border-0">
                    <Link
                      href={n.href}
                      onClick={() => {
                        if (!n.read) markRead([n.id]);
                        setOpen(false);
                      }}
                      className={`flex gap-3 px-4 py-3 hover:bg-surface-2 ${n.read ? "" : "bg-primary-soft/40"}`}
                    >
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${TONE[n.kind]}`} aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
                        <span>
                          {t.rich(n.kind === "slaWarn" || n.kind === "slaBreach" ? `kinds.${n.kind}.${n.target ?? "firstReply"}` : `kinds.${n.kind}`, {
                            actor: <bdi className="font-semibold">{n.actor ?? t("someone")}</bdi>,
                            subject: <bdi className="font-semibold">{n.subject}</bdi>,
                            percent: String(n.percent ?? ""),
                          })}
                        </span>
                        {n.quote && <span className="line-clamp-2 text-muted" dir="auto">“{n.quote}”</span>}
                        <span className="text-xs text-muted">{fmt.ago(n.at, now)}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label={t("unread")} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
