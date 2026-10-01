import { LanguageSwitch } from "@/components/language-switch";
import { SectionHeader, SettingsFrame, ListSurface } from "@/components/settings-frame";
import { SetupChecklist } from "@/components/setup-checklist";
import { getT } from "@/i18n/server";
import type { SetupStep } from "@/lib/setup";

const LATER = ["billing", "security", "data", "theme"] as const;

/** Settings › Account, shared by the real workspace and the preview. Language is the one personal setting live now. */
export async function AccountPage({ base, workspaceName, isOwner, steps, saveLanguageToProfile }: { base: string; workspaceName: string; isOwner: boolean; steps: SetupStep[]; saveLanguageToProfile: boolean }) {
  const t = await getT("account");
  const setup = await getT("setup");
  const common = await getT("common");

  return (
    <SettingsFrame base={base} active="account" isOwner={isOwner}>
      <SectionHeader title={t("title")} description={t("description", { workspace: workspaceName })} />
      <ListSurface>
        <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="grid">
            <span className="font-medium">{t("language.title")}</span>
            <span className="text-sm text-muted">{t("language.description")}</span>
          </span>
          <LanguageSwitch saveToProfile={saveLanguageToProfile} />
        </li>
      </ListSurface>
      {isOwner && <SetupChecklist steps={steps} title={setup("accountTitle")} />}
      <ListSurface>
        {LATER.map((k) => (
          <li key={k} className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 last:border-0">
            <span className="grid"><span className="font-medium">{t(`later.${k}.title`)}</span><span className="text-sm text-muted">{t(`later.${k}.body`)}</span></span>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{common("soon")}</span>
          </li>
        ))}
      </ListSurface>
    </SettingsFrame>
  );
}
