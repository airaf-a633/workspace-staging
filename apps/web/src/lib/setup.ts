/** The five-step setup checklist (PRODUCT_DECISIONS §14), shared by Home, Settings › Account and the preview. */
import type { TFor } from "@/i18n/types";

export type TeamShape = "solo" | "small" | "split" | "delivery" | null;

export interface SetupStep {
  title: string;
  body: string;
  done: boolean;
  href: string | null;
  soon: string | null;
}

export function setupSteps(t: TFor<"setup">, common: TFor<"common">, { shape, memberCount, connected, base }: { shape: TeamShape; memberCount: number; connected: boolean; base: string }): SetupStep[] {
  return [
    {
      title: t("connect.title"),
      body: t("connect.body"),
      done: connected,
      href: `${base}/whatsapp`,
      soon: connected ? null : t("connect.soon"),
    },
    {
      title: shape === "solo" ? t("invite.titleOptional") : t("invite.title"),
      body: shape === "solo" ? t("invite.bodySolo") : shape === "split" ? t("invite.bodySplit") : t("invite.body"),
      done: memberCount > 1,
      href: `${base}/members?invite=1`,
      soon: null,
    },
    { title: t("hours.title"), body: t("hours.body"), done: false, href: null, soon: common("comingSoon") },
    { title: t("import.title"), body: t("import.body"), done: false, href: null, soon: common("comingSoon") },
    { title: t("store.title"), body: t("store.body"), done: false, href: null, soon: common("comingSoon") },
  ];
}
