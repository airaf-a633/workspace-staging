import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/i18n/server";

export type SettingsSection = "members" | "teams" | "roles" | "channels" | "contacts" | "sla" | "ai" | "account";

/**
 * Settings as one page with a side sub-menu (decided 2026-09-30). The sections keep their own URLs
 * (`/members`, `/teams`, `/roles`, `/channels`, `/account`) so links and server actions stay the same.
 */
export async function SettingsFrame({ base, active, isOwner, children }: { base: string; active: SettingsSection; isOwner: boolean; children: ReactNode }) {
  const t = await getT("settings");
  const common = await getT("common");
  const items: { key: SettingsSection; label: string; href?: string }[] = [
    { key: "members", label: t("members"), href: `${base}/members` },
    { key: "teams", label: t("teams"), href: `${base}/teams` },
    ...(isOwner ? [{ key: "roles" as const, label: t("roles"), href: `${base}/roles` }] : []),
    { key: "channels", label: t("channels"), href: `${base}/channels` },
    // Contacts and privacy settings exist in the preview only until custom fields and retention are stored for real.
    ...(base.startsWith("/preview")
      ? [
          { key: "contacts" as const, label: t("contacts"), href: `${base}/contact-settings` },
          { key: "sla" as const, label: t("sla"), href: `${base}/sla` },
        ]
      : []),
    { key: "ai", label: t("ai"), href: `${base}/ai` },
    { key: "account", label: t("account"), href: `${base}/account` },
  ];

  return (
    <div className="grid gap-6">
      <h1 className="title text-3xl sm:text-4xl">{t("title")}</h1>
      <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
        <nav aria-label={t("title")} className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:grid md:content-start md:overflow-visible md:px-0">
          {items.map((i) =>
            i.href ? (
              <Link
                key={i.key}
                href={i.href}
                aria-current={i.key === active ? "page" : undefined}
                className={`flex min-h-10 shrink-0 items-center rounded-full px-3.5 text-sm transition-colors ${
                  i.key === active ? "bg-primary-soft font-semibold text-primary" : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                {i.label}
              </Link>
            ) : (
              <span key={i.key} className="flex min-h-10 shrink-0 items-center justify-between gap-2 rounded-full px-3.5 text-sm text-muted/70" aria-disabled="true">
                {i.label}
                <span className="rounded-full bg-surface-2 px-2 text-xs">{common("soon")}</span>
              </span>
            ),
          )}
        </nav>
        <div className="grid min-w-0 content-start gap-6">{children}</div>
      </div>
    </div>
  );
}

/** The heading of one settings section: a title, one line of help, and at most one action. */
export function SectionHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="max-w-xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

/** A plain list surface: rows divided by hairlines, no card inside a card. */
export function ListSurface({ children }: { children: ReactNode }) {
  return <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">{children}</ul>;
}
