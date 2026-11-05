/**
 * The setup checklist on Home (decided 2026-10-07, after the three-step welcome wizard): connect a channel,
 * invite the team, add the website chat, import contacts, set reply targets, try AI. Shared by Home,
 * Settings › Account and the preview. Real workspaces link only to screens that exist there today.
 */
import type { TFor } from "@/i18n/types";

export type TeamShape = "solo" | "small" | "split" | "delivery" | null;

export interface SetupStep {
  title: string;
  body: string;
  done: boolean;
  href: string | null;
  soon: string | null;
}

export function setupSteps(
  t: TFor<"setup">,
  common: TFor<"common">,
  { shape, memberCount, connected, base, done = [] }: { shape: TeamShape; memberCount: number; connected: boolean; base: string; done?: string[] },
): SetupStep[] {
  const preview = base.startsWith("/preview");
  // Screens that exist in a real workspace link to them; the others (Try AI) show as coming soon there. Website chat, contact
  // import and reply targets were preview-only when this list was written and are real now (checked 2026-11-04).
  const real = (path: string) => ({ href: `${base}${path}`, soon: null });
  const link = (path: string) => (preview ? real(path) : { href: null, soon: common("comingSoon") });
  return [
    { title: t("connect.title"), body: t("connect.body"), done: connected, href: `${base}/channels`, soon: null },
    {
      title: shape === "solo" ? t("invite.titleOptional") : t("invite.title"),
      body: shape === "solo" ? t("invite.bodySolo") : shape === "split" ? t("invite.bodySplit") : t("invite.body"),
      done: memberCount > 1,
      href: `${base}/members?invite=1`,
      soon: null,
    },
    { title: t("widget.title"), body: t("widget.body"), done: done.includes("widget"), ...real("/channels/new/webchat") },
    { title: t("import.title"), body: t("import.body"), done: done.includes("import"), ...real("/customers/import") },
    { title: t("targets.title"), body: t("targets.body"), done: done.includes("targets"), ...real("/sla") },
    { title: t("ai.title"), body: t("ai.body"), done: done.includes("ai"), ...link("/ai") },
  ];
}
